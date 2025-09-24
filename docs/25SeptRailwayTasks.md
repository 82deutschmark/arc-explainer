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

**Status**: 🔴 **CRITICAL** - Must fix before production deployment
**Priority**: 🚨 **HIGHEST** - Data loss occurring
**Impact**: 💸 **High financial impact** - Wasted API costs
