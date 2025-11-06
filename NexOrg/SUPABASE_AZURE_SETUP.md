    # Supabase + Microsoft Azure OAuth Setup Guide

This guide will help you configure Microsoft Azure OAuth with Supabase for seamless authentication in the NexOrg mobile app.

## Overview

With this setup:
- Users click "Continue with Microsoft" in your app
- They authenticate with their Microsoft account
- Supabase automatically creates/manages their session
- User data is stored in your Supabase database

## Part 1: Azure AD App Registration

### Step 1: Create Azure AD App

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** > **App registrations**
3. Click **New registration**
4. Fill in:
   - **Name**: NexOrg Mobile Application
   - **Supported account types**: "Accounts in any organizational directory and personal Microsoft accounts"
   - **Redirect URI**: Leave blank for now
5. Click **Register**

### Step 2: Get Credentials

1. On the **Overview** page, copy:
   - **Application (client) ID** - you'll need this for Supabase
   - **Directory (tenant) ID** - you'll need this for Supabase

2. Go to **Certificates & secrets** in the left sidebar
3. Click **New client secret**
4. Add a description (e.g., "Supabase OAuth")
5. Choose expiration (recommended: 24 months)
6. Click **Add**
7. **IMPORTANT**: Copy the **Value** immediately (you can't see it again!)

### Step 3: Configure Redirect URIs

1. Go to **Authentication** in the left sidebar
2. Click **Add a platform** > **Web**
3. You'll add the Supabase redirect URI here (we'll get it in Part 2)
4. For now, click **Configure** to save

## Part 2: Supabase Configuration

### Step 1: Enable Azure Provider

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Authentication** > **Providers**
4. Find **Azure** in the list
5. Toggle it **ON**

### Step 2: Configure Azure Provider

Fill in the following fields:

1. **Azure Tenant ID**: Paste the Directory (tenant) ID from Azure
2. **Azure Client ID**: Paste the Application (client) ID from Azure
3. **Azure Secret**: Paste the client secret value from Azure

4. **Redirect URL**: Copy this URL (it looks like):
   ```
   https://[your-project-ref].supabase.co/auth/v1/callback
   ```

5. Click **Save**

### Step 3: Add Redirect URI to Azure

1. Go back to Azure Portal
2. Navigate to your app registration > **Authentication**
3. Under **Web** platform, click **Add URI**
4. Paste the Supabase redirect URL you copied:
   ```
   https://[your-project-ref].supabase.co/auth/v1/callback
   ```
5. Click **Save**

### Step 4: Configure API Permissions (Azure)

1. In Azure Portal, go to **API permissions**
2. Click **Add a permission** > **Microsoft Graph**
3. Select **Delegated permissions**
4. Add these permissions:
   - `openid`
   - `profile`
   - `email`
   - `User.Read`
5. Click **Add permissions**
6. Click **Grant admin consent for [your organization]** (if you have admin rights)

## Part 3: Configure Mobile App Redirect

### Step 1: Add Mobile Redirect URI to Supabase

1. In Supabase Dashboard, go to **Authentication** > **URL Configuration**
2. Under **Redirect URLs**, add:
   ```
   nexorgmobileapplication://auth/callback
   ```
3. Click **Save**

### Step 2: Add Mobile Redirect to Azure

1. In Azure Portal, go to your app registration > **Authentication**
2. Click **Add a platform** > **Mobile and desktop applications**
3. Add custom redirect URI:
   ```
   nexorgmobileapplication://auth/callback
   ```
4. Click **Configure**

## Part 4: Test the Integration

### Step 1: Verify Configuration

Make sure you have:
- ✅ Azure app with Client ID and Secret
- ✅ Redirect URIs configured in both Azure and Supabase
- ✅ Azure provider enabled in Supabase
- ✅ API permissions granted in Azure

### Step 2: Test in Your App

1. Rebuild your development client:
   ```bash
   eas build --profile development --platform android
   ```

2. Install the new APK on your phone

3. Start your dev server:
   ```bash
   npx expo start --dev-client
   ```

4. Open the app and click "Continue with Microsoft"

5. You should:
   - See Microsoft login page
   - Sign in with your Microsoft account
   - Grant permissions
   - Be redirected back to the app
   - See success message with your email

## Troubleshooting

### "Invalid redirect URI" error
- Verify the redirect URI in Azure exactly matches the Supabase callback URL
- Check that mobile redirect URI is added to both Azure and Supabase

### "AADSTS50011: The reply URL specified in the request does not match"
- Make sure you added the redirect URI to the correct platform in Azure
- Web platform: `https://[project].supabase.co/auth/v1/callback`
- Mobile platform: `nexorgmobileapplication://auth/callback`

### "Provider not enabled" error
- Ensure Azure provider is toggled ON in Supabase
- Verify Client ID and Secret are correctly entered
- Check that you clicked "Save" in Supabase

### "Failed to fetch user info" error
- Verify API permissions are granted in Azure
- Make sure `User.Read` permission is included
- Try granting admin consent

### User signs in but session not created
- Check Supabase logs: Dashboard > Logs > Auth logs
- Verify the email scope is included in Azure permissions
- Ensure redirect URLs are whitelisted in Supabase

## How It Works

1. User clicks "Continue with Microsoft"
2. App calls `supabase.auth.signInWithOAuth({ provider: 'azure' })`
3. Supabase generates OAuth URL with your Azure app credentials
4. App opens Microsoft login in browser
5. User authenticates with Microsoft
6. Microsoft redirects to Supabase callback URL with auth code
7. Supabase exchanges code for tokens
8. Supabase creates user session
9. App redirects back with session token
10. User is authenticated in both Microsoft and Supabase!

## User Data in Supabase

After successful sign-in, Supabase automatically creates a user record with:
- `id`: Unique Supabase user ID
- `email`: User's Microsoft email
- `user_metadata`: Contains Microsoft profile data
- `app_metadata`: Provider info (azure)
- `created_at`: Timestamp

You can access this in your app via:
```typescript
const { data: { user } } = await supabase.auth.getUser();
```

## Security Best Practices

1. **Rotate secrets regularly** - Update client secrets every 12-24 months
2. **Use environment variables** - Never hardcode credentials
3. **Limit permissions** - Only request scopes you actually need
4. **Monitor auth logs** - Check Supabase logs for suspicious activity
5. **Enable MFA** - Require multi-factor authentication for admin accounts

## Additional Resources

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Microsoft Identity Platform](https://docs.microsoft.com/en-us/azure/active-directory/develop/)
- [Expo AuthSession](https://docs.expo.dev/versions/latest/sdk/auth-session/)
