# Google OAuth Setup Guide for Docker

## Current Configuration

- **Application URL**: `http://localhost:3000` (host) → `http://localhost:8080` (container)
- **Redirect URI**: `http://localhost:3000/auth/google/callback`
- **Environment**: Variables loaded from `.env` file

## Step-by-Step Setup

### 1. Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select or create a project
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. If prompted, configure the OAuth consent screen first:
   - User Type: **External** (for testing)
   - App name: Your app name
   - User support email: Your email
   - Developer contact: Your email
   - Click **Save and Continue**
   - Scopes: Click **Save and Continue** (default is fine)
   - Test users: Add your email, click **Save and Continue**
6. Create OAuth Client ID:
   - Application type: **Web application**
   - Name: `AltoAI MVP` (or any name)
   - **Authorized JavaScript origins**: 
     ```
     http://localhost:3000
     ```
   - **Authorized redirect URIs**: 
     ```
     http://localhost:3000/auth/google/callback
     ```
   - Click **Create**
7. Copy the **Client ID** and **Client Secret**

### 2. Update `.env` File

Edit the `.env` file in the project root and replace the placeholder values:

```env
GOOGLE_CLIENT_ID=your-actual-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-actual-client-secret
GOOGLE_REDIRECT_URL=http://localhost:3000/auth/google/callback
```

**Important**: 
- Use the exact Client ID and Secret from Google Cloud Console
- The redirect URL must match exactly: `http://localhost:3000/auth/google/callback`
- No trailing slashes or extra spaces

### 3. Restart Docker Containers

After updating `.env`, restart the containers:

```bash
docker-compose down
docker-compose up -d
```

### 4. Verify Environment Variables

Check that the variables are loaded correctly:

```bash
docker exec altoai-mvp env | grep GOOGLE
```

You should see:
```
GOOGLE_CLIENT_ID=your-actual-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-actual-client-secret
GOOGLE_REDIRECT_URL=http://localhost:3000/auth/google/callback
```

### 5. Test the OAuth Flow

1. Open your browser: `http://localhost:3000`
2. Click "Sign in with Google"
3. You should be redirected to Google's login page
4. After authentication, you should be redirected back to your app

## Common Issues & Fixes

### Issue 1: "OAuth client was not found" / "invalid_client"

**Cause**: Wrong Client ID or Secret, or not loaded into container

**Fix**:
- Verify credentials in `.env` file are correct (no typos)
- Restart containers: `docker-compose down && docker-compose up -d`
- Check variables in container: `docker exec altoai-mvp env | grep GOOGLE`

### Issue 2: "Redirect URI mismatch"

**Cause**: Redirect URI in Google Console doesn't match what the app sends

**Fix**:
- In Google Cloud Console, ensure redirect URI is exactly: `http://localhost:3000/auth/google/callback`
- Check for typos, extra spaces, or wrong port
- Make sure you're using `http://` not `https://` for localhost
- Use `localhost` not `127.0.0.1`

### Issue 3: "Access blocked: This app's request is invalid"

**Cause**: OAuth consent screen not configured or app in testing mode

**Fix**:
- Complete the OAuth consent screen setup in Google Cloud Console
- Add your email as a test user if app is in testing mode
- Publish the app if you want to allow all users (for production)

### Issue 4: Environment variables not loading

**Cause**: `.env` file not in correct location or docker-compose not reading it

**Fix**:
- Ensure `.env` file is in the same directory as `docker-compose.yml`
- Check `env_file: - .env` is in docker-compose.yml (it is)
- Restart containers after changing `.env`

### Issue 5: Cookie/Session Issues

**Cause**: Cookies not being set due to HTTP/HTTPS mismatch

**Fix**:
- For local development, ensure cookies are set with `SameSite=Lax` (default)
- If using `Secure: true`, you need HTTPS (not needed for localhost)

## Verification Checklist

- [ ] Google OAuth credentials created in Google Cloud Console
- [ ] Authorized redirect URI set to: `http://localhost:3000/auth/google/callback`
- [ ] Authorized JavaScript origin set to: `http://localhost:3000`
- [ ] `.env` file updated with real Client ID and Secret
- [ ] No typos or extra spaces in `.env` file
- [ ] Docker containers restarted after updating `.env`
- [ ] Environment variables verified in container
- [ ] OAuth consent screen configured
- [ ] Test user added (if app is in testing mode)

## Current Docker Configuration

The `docker-compose.yml` is configured to:
- Load environment variables from `.env` file
- Set `GOOGLE_REDIRECT_URL` to `http://localhost:3000/auth/google/callback`
- Use port mapping `3000:8080` (host:container)

## Need Help?

If you're still having issues:
1. Check container logs: `docker-compose logs altoai-mvp`
2. Verify environment variables: `docker exec altoai-mvp env | grep GOOGLE`
3. Test the redirect URL manually: Visit `http://localhost:3000/auth/google` in browser
4. Check Google Cloud Console for any error messages




