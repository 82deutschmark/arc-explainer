# Railway Deployment Data Persistence Issue - 25 September 2025

## 🚨 **Critical Problem Identified**

Your ARC Explainer application has a **fundamental data loss issue** in production deployments on Railway.

## 📋 **The Problem**

### **Current Behavior (Broken)**
- ✅ **Local development**: Raw JSON logs and other data saved to the `data/` directory persist between application runs.
- ❌ **Railway production**: The same data is saved to an ephemeral filesystem and is **permanently lost on every new deployment or restart**.

### **Why This Happens**
By default, Railway uses **ephemeral filesystems** for deployments. When your container restarts for any reason (like a new deployment or a system update), the filesystem is wiped clean, and any data saved there is erased.

### **Impact**
- 💸 **Lost Money**: Expensive AI analysis results that fail to save to the database are lost, forcing you to re-run them and incur extra costs.
- 📊 **Lost Data**: You lose valuable logs and model performance data, making it impossible to analyze or debug production issues.
- 🔄 **No Recovery**: The `npm run recover` script, which relies on these local logs, is useless in production.

## 🎯 **The Solution: Configure a Persistent Volume in `railway.json`**

To solve this, you must instruct Railway to attach a **persistent volume** to your service. This is a network-attached storage drive that survives deployments.

### **Step 1: Update Your `railway.json`**

Your project uses a `railway.json` file and a `Dockerfile`. You need to add a `volumes` array to the `deploy` section of this file. This tells Railway to mount a persistent volume into your container at the specified path.

Update your `railway.json` to look like this:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "DOCKERFILE"
  },
  "deploy": {
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10,
    "startCommand": "node dist/index.js",
    "healthcheckPath": "/",
    "healthcheckTimeout": 300,
    "numReplicas": 1,
    "volumes": [
      {
        "name": "arc_explainer_data",
        "mountPoint": "/app/data"
      }
    ]
  }
}
```

**Key Changes:**
- **`"builder": "DOCKERFILE"`**: This correctly reflects that your project is built using the `Dockerfile`.
- **`"volumes": [...]`**: This new section defines the persistent volume.
  - **`"name"`**: A unique name for your volume within the Railway project.
  - **`"mountPoint"`**: The absolute path inside the container where the volume should be attached. Your `Dockerfile` sets up the application in `/app`, so `/app/data` is the correct path to persist your `data` directory.

### **Step 2: Deploy and Verify**

1.  **Commit your updated `railway.json` file** to your GitHub repository.
2.  **Push the commit** to trigger a new deployment on Railway.
3.  **Monitor the deployment** in your Railway dashboard. Railway will automatically provision the `arc_explainer_data` volume and attach it to your service.

### **Step 3: Verify Persistent Storage**

Once the new deployment is live, you can verify that the volume is working correctly.

1.  **Open a shell** into your running service container:
    ```bash
    railway shell
    ```
2.  **Create a test file** inside the mounted data directory:
    ```bash
    echo "Persistence test!" > /app/data/test.txt
    ```
3.  **Redeploy your service** from the Railway dashboard by clicking "Redeploy" or pushing another commit.
4.  **Open a new shell** into the container after it has finished redeploying.
5.  **Check if the test file still exists**:
    ```bash
    cat /app/data/test.txt
    ```
    If you see "Persistence test!", your volume is working correctly.

## 🔧 **What This Fixes**

This change fundamentally solves the data loss problem.

### **Before (Broken)**
`API Call` → `AI Analysis` → `Save to /app/data/` → `Database Save Fails`
**Result**: On the next deploy, `/app/data/` is wiped, and the raw log is **lost forever**.

### **After (Fixed)**
`API Call` → `AI Analysis` → `Save to /app/data/` → `Database Save Fails`
**Result**: On the next deploy, the volume is re-attached, the log is still present, and you can **run your recovery scripts** to save the data to the database.

## 📊 **Benefits You'll Get**

1. **💰 Cost Recovery**: Retry failed database saves instead of losing money
2. **📈 Analytics**: Complete model performance data for all puzzles
3. **🐛 Debugging**: Full production logs for troubleshooting
4. **🔄 Reliability**: Never lose expensive AI responses
5. **📋 Recovery**: `npm run recover` works in production too

## ⚡ **Action Plan Summary**

1.  **Update `railway.json`**: Add the `volumes` array to the `deploy` section as shown in the example above.
2.  **Commit and Push**: Save the changes and push them to your GitHub repository to trigger a new deployment.
3.  **Verify in Dashboard**: Go to your service settings in the Railway dashboard and confirm that a volume is now attached.
4.  **Test with a File**: Use `railway shell` to create a test file in `/app/data`, redeploy, and verify the file persists.

## 🚀 **Next Steps After the Fix**

With persistent storage in place, you can now:

-   **Run Recovery Scripts**: Safely run `npm run recover` in a production shell to process logs that failed to save to the database.  THIS NEEDS TO RUN AUTOMATICALLY ONCE A DAY!!  
-   **Analyze Production Data**: Your analysis and debugging scripts can now access a complete history of production logs.
-   **Monitor Volume Usage**: Keep an eye on your volume's storage usage in the Railway dashboard. Note that Railway plans have different storage limits.

---

## Part 2: Automating Data Recovery with a Cron Job

Now that you have persistent storage, you can automate the data recovery process to ensure no analysis is ever permanently lost. As you noted, this should run automatically.

To do this, you will create a **second, separate service** in your Railway project dedicated solely to running the recovery script on a schedule.

### **Step 1: Create the New Cron Service**

1.  In your Railway project, click **New** > **Service**.
2.  Select **Deploy from GitHub repo** and choose your `arc-explainer` repository again.
3.  Railway will create a new service. Give it a distinct name, like `arc-explainer-cron` or `recovery-job`.

### **Step 2: Configure the Cron Service**

This new service needs a different configuration from your main web app. Go to its **Settings** tab and configure the following:

1.  **Build Settings**:
    *   Builder: `DOCKERFILE`
    *   Dockerfile Path: `./Dockerfile` (should be the default)

2.  **Deploy Settings**:
    *   **Start Command**: This is the most important part. Change it to run your recovery script:
        ```
        npm run recover
        ```
    *   **Cron Schedule**: Set this to run once a day. This expression runs the job every day at 5:00 AM UTC. You can adjust the time as needed.
        ```
        0 5 * * *
        ```

3.  **Variables**: Copy any necessary environment variables from your main app service that the recovery script might need (like database connection strings).

### **Step 3: Attach the Persistent Volume**

For the recovery script to find the logs, the cron service **must be connected to the same persistent volume** as your main application.

1.  Go to the settings for your new `recovery-job` service.
2.  Find the **Volumes** section.
3.  Click to attach an existing volume and select `arc_explainer_data` (the volume created for your main app).
4.  Set the **Mount Path** to be the same as your main app:
    ```
    /app/data
    ```

### **How It Works**

With this setup:

-   Your main `arc-explainer` app runs 24/7, handling user requests and saving logs to the `/app/data` volume.
-   Once a day, at 5:00 AM UTC, Railway will automatically start the `recovery-job` service.
-   The `recovery-job` service will execute its start command (`npm run recover`), read the logs from the shared `/app/data` volume, process them, and save the results to your database.
-   After the script finishes, the `recovery-job` service will shut down, consuming no further resources until the next scheduled run.

**Status**: 🔴 **CRITICAL** - Must fix before production deployment
**Priority**: 🚨 **HIGHEST** - Data loss occurring
**Impact**: 💸 **High financial impact** - Wasted API costs
