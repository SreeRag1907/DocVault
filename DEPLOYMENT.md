# Deploying DocVault AI to AWS

This covers RDS, S3, IAM (both the instance role and the separate
backup user), and EC2 + PM2 + Nginx. Read **Why this layout** first —
you'll want to explain these choices in an interview, not just that
you followed steps.

## Why this layout

- **RDS instead of Postgres-in-Docker**: a self-hosted database is
  Docker experience, not AWS experience. RDS is a distinct, real AWS
  service — and it means you never manage backups, patching, or
  replication yourself.
- **One IAM Role for the EC2 instance, scoped to `documents/*` only**:
  the backend gets temporary, auto-rotating credentials from the
  instance metadata service. No access keys anywhere in code or `.env`.
- **A separate IAM User, scoped to `backups/*` only**, used solely by
  a nightly cron script: a different identity for a different job,
  with no overlap in permissions with the app's own role. This is the
  concrete, defensible answer to "what's the difference between an
  IAM role and an IAM user, and when do you use each."
- **The backend runs on the host via PM2**, not in a container — same
  reasoning as before: this app doesn't need to introspect Docker, so
  there's no reason to add a container layer.

## 1. Create the RDS instance

1. AWS Console → RDS → Create database.
2. Engine: **PostgreSQL** (16.x).
3. Templates: **Free tier** (if eligible) or **Dev/Test**.
4. DB instance identifier: `docvault-db`.
5. Master username/password: set these — you'll put them in `backend/.env`.
6. Instance class: `db.t3.micro` / `db.t4g.micro`.
7. **Connectivity** → VPC: same VPC as your EC2 instance (or default).
   **Public access: No** — only your EC2 instance should reach it.
8. Create a new security group for RDS (or use an existing one), and
   after creating the EC2 instance (next section), add an inbound rule:
   | Type | Port | Source |
   |---|---|---|
   | PostgreSQL | 5432 | the EC2 instance's security group (not 0.0.0.0/0) |
9. Once available, copy the **endpoint** (looks like
   `docvault-db.xxxxxxxx.ap-south-1.rds.amazonaws.com`) — this is
   `PGHOST` in `backend/.env`. Set `PGSSL=true`.

## 2. Create the S3 bucket

1. S3 → Create bucket → name it something globally unique, e.g.
   `docvault-files-<yourname>`.
2. Keep **Block all public access** ON — nothing in this bucket is
   ever public; every file access goes through a presigned URL minted
   by the backend.
3. **Permissions → CORS** — add this (the browser uploads directly to
   S3 from your site's origin, so S3 needs to allow it):
   ```json
   [
     {
       "AllowedOrigins": ["http://<EC2_PUBLIC_IP>", "https://yourdomain.com"],
       "AllowedMethods": ["PUT", "GET"],
       "AllowedHeaders": ["*"],
       "MaxAgeSeconds": 3000
     }
   ]
   ```
4. Set `S3_BUCKET` in `backend/.env` to the bucket name.

## 3. Create the IAM role (for the EC2 instance)

1. IAM → Roles → Create role.
2. Trusted entity: **AWS service** → **EC2**.
3. Skip attaching a managed policy for now → name it `docvault-ec2-role` → Create.
4. Open the role → **Add permissions → Create inline policy** → JSON tab
   → paste the contents of `deploy/iam/ec2-instance-role-policy.json`,
   replacing `docvault-files-yourname` with your real bucket name.
5. Name the policy `docvault-s3-runtime-access` and save.

You'll attach this role to the EC2 instance in the next section.

## 4. Create the IAM user (for backups only)

1. IAM → Users → Create user → name it `docvault-backup-script`.
2. **Do not** enable console access — this is a programmatic-only user.
3. Attach permissions → Create inline policy → JSON → paste
   `deploy/iam/backup-user-policy.json` (same bucket name substitution).
4. After creating the user, go to **Security credentials → Create
   access key → Use case: Application running outside AWS** (since the
   backup script just calls the AWS CLI directly with these keys).
5. Save the access key ID and secret — you'll put them in the backup
   script's own environment, never in `backend/.env`. This keeps them
   physically separate from the app's runtime credentials.

## 5. Launch the EC2 instance

1. EC2 → Launch instance. AMI: **Ubuntu Server 22.04 LTS**. Type: `t2.micro`/`t3.micro`.
2. **Advanced details → IAM instance profile** → select `docvault-ec2-role`.
3. Security group:
   | Type | Port | Source |
   |---|---|---|
   | SSH | 22 | your IP only |
   | HTTP | 80 | 0.0.0.0/0 |
4. Launch, note the public IP, then go back to the RDS security group
   (step 1.8) and allow inbound 5432 from this instance's security group.

## 6. Install dependencies on the instance

```bash
ssh -i your-key.pem ubuntu@<EC2_PUBLIC_IP>
sudo apt update && sudo apt upgrade -y

# Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# poppler-utils - provides `pdftotext`, used for AI-summary text extraction
sudo apt install -y poppler-utils

sudo npm install -g pm2
sudo apt install -y nginx
```

Verify `pdftotext` is on the PATH (the backend shells out to it):

```bash
pdftotext -v
```

## 7. Get the code and configure it

```bash
sudo mkdir -p /var/www/docvault && sudo chown $USER:$USER /var/www/docvault
cd /var/www/docvault
git clone <your-repo-url> .

cp backend/.env.example backend/.env
nano backend/.env
```

Set in `backend/.env`:
- `PGHOST` → your RDS endpoint, `PGSSL=true`
- `PGPASSWORD` → your RDS master password
- `JWT_SECRET` → `openssl rand -base64 32`
- `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` → your real login
- `S3_BUCKET`, `AWS_REGION` → from step 2
- `OPENAI_API_KEY` → your real key
- `WEB_ORIGIN` → `http://<EC2_PUBLIC_IP>`
- Leave `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` **unset** — the IAM role supplies these.

## 8. Build and start the backend

```bash
cd /var/www/docvault/backend
npm install
npm run build

cd /var/www/docvault
pm2 start deploy/ecosystem.config.js
pm2 save
pm2 startup   # run the command it prints
```

Verify:
```bash
curl http://localhost:4000/api/health   # {"ok":true}
```

If this fails, check `pm2 logs docvault-api` — most likely culprit is
an RDS security group not yet allowing the EC2 instance, or a wrong
`PGPASSWORD`.

## 9. Build the frontend and wire up Nginx

```bash
cd /var/www/docvault/frontend
npm install
npm run build

sudo cp /var/www/docvault/deploy/nginx.conf /etc/nginx/sites-available/docvault
sudo ln -s /etc/nginx/sites-available/docvault /etc/nginx/sites-enabled/docvault
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Visit `http://<EC2_PUBLIC_IP>` and log in with your seeded admin credentials.

## 10. Set up the nightly backup (the separate IAM user, in action)

```bash
sudo nano /usr/local/bin/docvault-backup.sh
```

```bash
#!/bin/bash
export AWS_ACCESS_KEY_ID="<backup-user-access-key>"
export AWS_SECRET_ACCESS_KEY="<backup-user-secret>"
export AWS_DEFAULT_REGION="ap-south-1"
export PGPASSWORD="<rds-password>"

DATE=$(date +%F)
pg_dump -h <rds-endpoint> -U docvault docvault > /tmp/docvault-$DATE.sql
aws s3 cp /tmp/docvault-$DATE.sql s3://docvault-files-yourname/backups/docvault-$DATE.sql
rm /tmp/docvault-$DATE.sql
```

```bash
sudo chmod +x /usr/local/bin/docvault-backup.sh
crontab -e
# add: 0 3 * * * /usr/local/bin/docvault-backup.sh
```

This script's credentials can **only** write to `backups/*` — even if
this script were somehow compromised, it cannot read, modify, or
delete anything under `documents/*`, and the main app's IAM role
cannot touch `backups/*` either. Two identities, two blast radii.

## Redeploying after a change

```bash
cd /var/www/docvault && git pull
cd backend && npm install && npm run build && pm2 restart docvault-api
cd ../frontend && npm install && npm run build   # Nginx picks up the new dist/ immediately
```

## 11. CI/CD Pipeline (GitHub Actions Automation)

To configure automatic deployment on every git push to your `main` branch:

1. In your GitHub repository, navigate to **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
2. Add the following secrets:
   - `EC2_HOST`: The public IP of your EC2 instance.
   - `EC2_SSH_KEY`: The contents of your private key `.pem` file. Make sure it contains the header/footer (e.g., `-----BEGIN RSA PRIVATE KEY-----` / `-----END RSA PRIVATE KEY-----`).
3. Push code to the `main` branch. GitHub Actions will automatically run the `.github/workflows/deploy.yml` pipeline which SSHs into the EC2 instance, performs a git pull, reinstalls dependencies, builds frontend and backend code, and restarts the PM2 process.

## 12. Logging and Monitoring (AWS CloudWatch Logs)

To push Nginx and Node/PM2 application logs to AWS CloudWatch:

1. **Attach IAM Policy**: Go to IAM → Roles → select `docvault-ec2-role`. Click **Add permissions** → **Attach policies** → search for and select **`CloudWatchAgentServerPolicy`**. This grants the agent permission to ship log data to AWS.
2. **Install CloudWatch Agent**: SSH into your EC2 instance and run:
   ```bash
   wget https://amazoncloudwatch-agent.s3.amazonaws.com/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
   sudo dpkg -i -E ./amazon-cloudwatch-agent.deb
   ```
3. **Copy Configuration**: We have created a configuration file in `deploy/amazon-cloudwatch-agent.json`. Copy it to the agent directory:
   ```bash
   sudo mkdir -p /opt/aws/amazon-cloudwatch-agent/etc/
   sudo cp /var/www/docvault/deploy/amazon-cloudwatch-agent.json /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
   ```
4. **Start the Agent**: Initialize and start the agent service:
   ```bash
   sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
     -a fetch-config \
     -m ec2 \
     -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json \
     -s
   ```
5. **Verify**: Open AWS Console → **CloudWatch** → **Logs** → **Log groups**. You will see your log streams feeding directly into:
   - `docvault-nginx-access`
   - `docvault-nginx-error`
   - `docvault-pm2-stdout`
   - `docvault-pm2-stderr`

## 13. Containerized Deployment (Docker & Docker Compose)

Dockerizing the application ensures consistency across development, staging, and production environments, and avoids having to manually install dependencies like Node.js or `poppler-utils` on your EC2 host.

### A. Local Run via Docker Compose
To run the fully containerized application stack locally:
1. Ensure you have your environment variables defined in a `.env` file in your root workspace.
2. Spin up the containers:
   ```bash
   docker compose up --build -d
   ```
3. Nginx serves the React client on port `80` and routes `/api` calls automatically to the backend on port `4000`.

### B. Deployment to EC2 via Docker
Instead of installing Node.js, PM2, and Nginx manually on the EC2 host:
1. Install Docker and Docker Compose on Ubuntu EC2:
   ```bash
   sudo apt-get update
   sudo apt-get install -y docker.io docker-compose-v2
   sudo usermod -aG docker ubuntu
   # Log out and log back in to apply group membership
   ```
2. Clone the repository and configure the `.env` file in the project root.
3. Build and launch:
   ```bash
   docker compose up --build -d
   ```
4. Update the GitHub Actions workflow to run `docker compose up --build -d` instead of building via npm and restarting PM2, if you decide to fully migrate to a containerized production deployment.

## 14. Frontend Deployment Options

You have three primary options for deploying the static Vite/React frontend.

### Option A: Co-located on the EC2 Host (Default & Easiest)
In this layout (detailed in Section 9), Nginx runs on the same EC2 instance as the Node API. Nginx serves the compiled frontend static files directly from `/var/www/docvault/frontend/dist` and proxies API requests on `/api/*` to the backend running locally on port `4000`.
- **Best for**: Small applications, simple configurations, low initial complexity, and zero extra costs.

### Option B: Cloud-Native Hosting (S3 + CloudFront CDN)
For production-grade environments, the frontend is deployed to a private S3 bucket and served globally via a CloudFront CDN. CloudFront handles HTTPS, caches assets at regional edge locations for speed, and shields the S3 bucket.

#### Step-by-Step S3 + CloudFront Setup:

1. **Create S3 Bucket**:
   - Go to **S3** → **Create bucket** (e.g., `docvault-ui-bucket`).
   - Turn **ON** "Block all public access" (we will grant access securely using CloudFront Origin Access Control).
2. **Build and Upload Frontend**:
   - Run `npm run build` in the frontend directory.
   - Upload all files from the `frontend/dist/` directory directly to your S3 bucket root.
3. **Create CloudFront Distribution**:
   - Go to **CloudFront** → **Create distribution**.
   - **Origin domain**: Select your frontend S3 bucket.
   - **Origin access**: Select **Origin access control settings (recommended)**. Click **Create control setting** and select your bucket.
   - **Viewer protocol policy**: Select **Redirect HTTP to HTTPS**.
   - **Default root object**: Set to `index.html`.
4. **Create Distribution and Update S3 Bucket Policy**:
   - Once the distribution is created, copy the generated S3 bucket policy from CloudFront.
   - Go to your S3 bucket → **Permissions** → **Bucket policy** → **Edit**, paste the copied policy (which allows CloudFront to read bucket contents), and save.
5. **Configure SPA Client-Side Routing**:
   - In CloudFront, go to the **Error pages** tab.
   - Click **Create custom error response**.
   - HTTP error code: **404: Not Found**.
   - Customize error response: **Yes**.
   - Response page path: `/index.html`.
   - HTTP Response code: **200: OK**.
   - *(This ensures page refreshes on sub-routes like `/documents/:id` work correctly).*
6. **Set up Routing to Backend**:
   - In CloudFront → **Origins** → **Create origin** → Origin domain: Enter your EC2 public IP or Application Load Balancer endpoint. Name it `EC2Backend`.
   - Go to the **Behaviors** tab → **Create behavior**:
     - Path pattern: `/api/*`.
     - Target origin: Select `EC2Backend`.
     - Cache policy: **CachingDisabled** (dynamic endpoints should never be cached).
     - Origin request policy: **AllViewerExceptHostHeader** (passes parameters, headers, and cookies to backend).

Now, navigating to your CloudFront URL will serve your React app from S3, while any `/api/*` call will automatically get routed to your EC2 backend!

### Option C: Managed Hosting on Vercel (Recommended for Developer Velocity)
For maximum simplicity and performance, you can deploy the React frontend directly to Vercel. Vercel automatically deploys your site globally on their Edge Network with features like instant cache invalidation, automated preview URLs, and built-in SSL.

#### Step-by-Step Vercel Setup:

1. **Configure SPA Routing (`vercel.json`)**:
   Ensure there is a `vercel.json` file inside your `frontend/` folder. This handles SPA client-side routing, rewriting all dynamic paths back to `/index.html` so refreshes don't result in Vercel 404 errors:
   ```json
   {
     "rewrites": [
       { "source": "/(.*)", "destination": "/index.html" }
     ]
   }
   ```
   *(Note: This file is already configured in the codebase).*

2. **Add CORS Domain in AWS S3**:
   Since Vercel hosts the frontend on its own domain, the browser will upload files directly to your S3 bucket. You must update your S3 bucket's CORS settings to allow requests from your Vercel domain:
   - Go to **S3** → Select your bucket → **Permissions** → **Cross-origin resource sharing (CORS)**.
   - Add your Vercel domain (e.g. `https://docvault-frontend.vercel.app`) to the allowed origins list:
     ```json
     [
       {
         "AllowedOrigins": [
           "https://docvault-frontend.vercel.app",
           "http://localhost:5173"
         ],
         "AllowedMethods": ["PUT", "GET"],
         "AllowedHeaders": ["*"],
         "MaxAgeSeconds": 3000
       }
     ]
     ```

3. **Deploy the Project on Vercel**:
   - Sign in to [Vercel](https://vercel.com).
   - Click **Add New** → **Project**.
   - Import your GitHub/GitLab repository.
   - Set **Root Directory** to `frontend`.
   - Select **Vite** as the Framework Preset (Vercel automatically configures the build command as `npm run build` and output directory as `dist`).
   - Under **Environment Variables**, add:
     - `VITE_API_BASE_URL`: The URL of your backend API (e.g., `http://<EC2_PUBLIC_IP>` or `https://api.yourdomain.com`). Make sure there is **no trailing slash** (e.g., do not append `/api` as the frontend adds `/api` automatically).
   - Click **Deploy**.

4. **Update Backend CORS Configuration**:
   - On your backend server, update the `WEB_ORIGIN` environment variable in `backend/.env` to match your Vercel deployment URL (e.g., `WEB_ORIGIN=https://docvault-frontend.vercel.app`).
   - Restart the backend server (`pm2 restart docvault-api`) so that Express accepts cross-origin requests from Vercel.

## Troubleshooting

| Symptom | Check |
|---|---|
| Backend won't connect to RDS | RDS security group must allow the EC2 instance's SG on 5432; `PGSSL=true` |
| Upload succeeds but app 404s on the file | CORS not set on the bucket, or wrong region in `.env` |
| "Summarize" always fails | `pdftotext -v` works? `OPENAI_API_KEY` set and valid? |
| 502 on `/api/*` | `pm2 status` — backend probably crashed, check `pm2 logs` |
| GitHub Action fails to SSH | Check that your EC2 security group allows SSH on port 22 from the public internet (or GitHub IP range). |
| CloudWatch logs not appearing | Verify that `CloudWatchAgentServerPolicy` is attached to `docvault-ec2-role` and that the agent is running (`sudo systemctl status amazon-cloudwatch-agent`). |
