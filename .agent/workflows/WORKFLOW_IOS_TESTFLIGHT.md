---
description: Guide to build and upload iOS app to TestFlight
---

# iOS TestFlight Deployment Guide

This guide describes how to archive and upload your React Native iOS app to TestFlight using Xcode.

## Prerequisites
- Apple Developer Account ($99/year).
- Xcode installed and updated.
- App ID registered in Apple Developer Portal.
- App record created in App Store Connect.

## Step 1: Prepare the Project
1. Open your project in Xcode:
   ```bash
   cd ios
   xcodebuild -workspace BookVault.xcworkspace -scheme BookVault
   # Or simply open BookVault.xcworkspace file in Xcode
   ```
2. Navigate to the **General** tab of your primary target.
   - **Bundle Identifier**: Ensure it matches your App ID (e.g., `com.mehmetranas.bookvault`).
   - **Version**: Set your marketing version (e.g., `1.0.0`).
   - **Build**: Increment this number for every upload (e.g., `1`, `2`, `3`...).

## Step 2: Signing & Capabilities
1. Go to the **Signing & Capabilities** tab.
2. Ensure **Automatically manage signing** is checked.
3. Select your **Team** (your personal or company Apple Developer Team).
   - If you don't see your team, go to **Xcode > Settings > Accounts** and add your Apple ID.

## Step 3: Create an Archive
1. Select **Any iOS Device (arm64)** from the device simulator dropdown (top status bar).
   - *Note: You cannot archive targeting a Simulator.*
2. Go to **Product > Archive** in the top menu.
3. Wait for the build to complete. This may take several minutes.
4. Once finished, the **Organizer** window will open with your new archive selected.

## Step 4: Validate and Upload
1. In the Organizer window, click **Validate App** to check for any obvious issues (optional but recommended for first time).
2. Click **Distribute App**.
3. Select **TestFlight & App Store**.
4. Click **Distribute**.
5. Xcode will prepare the app, sign it, and upload it to Apple's servers.

## Step 5: App Store Connect (TestFlight)
1. Go to [App Store Connect](https://appstoreconnect.apple.com).
2. Select your app.
3. Go to the **TestFlight** tab.
4. You should see your uploaded build processing.
5. Once processing is complete (can take 10-20 mins), you might need to answer "Export Compliance" questions.
6. Create a "Group" or add "Internal Testers" (yourself) to start testing immediately.
7. You will receive an email with an invite to test via the TestFlight app on your iPhone.

## Common Issues
- **Icons**: Ensure you have all required App Icon sizes in `Images.xcassets`.
- **Permissions**: Ensure `Info.plist` has usage descriptions for any permissions you request (Camera, Photo Library, etc.).
