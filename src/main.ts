import { app, BrowserWindow, ipcMain } from "electron";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFile,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import os from "node:os";
// In this file you can include the rest of your app's specific main process code.
// You can also put them in separate files and import them here.

// CONSTANTS
const sourceWidgetsDir = path.join(__dirname, "widgets");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const widgetsDir = path.join(os.homedir(), "Desktop", "widgets");
const widgetsJsonPath = path.join(widgetsDir, "widgets.json");

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  app.quit();
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  copyWidgetsDirIfNeeded(sourceWidgetsDir, widgetsDir);
  createWindow();
  createWindowsForWidgets();

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

/**
 * IPC FUNCTIONS
 * Inter-process communication (IPC) is a key part of building feature-rich desktop applications in Electron.
 * Because the main and renderer processes have different responsibilities in Electron's process model,
 * IPC is the only way to perform many common tasks, such as calling a native API from your UI or
 * triggering changes in your web contents from native menus.
 */

/**
 * Handles the 'window-action' IPC message by performing an action on the focused window.
 * When the 'window-action' message is received, this gets the currently focused
 * BrowserWindow instance and performs an action (minimize, close) based on the
 * passed action parameter.
 */
ipcMain.handle("window-action", (event, action) => {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    switch (action) {
      case "minimize":
        win.minimize();
        break;
      case "close":
        win.close();
        break;
      default:
        console.log(`Unknown action: ${action}`);
    }
  }
});

/**
 * Handles the 'read-widgets-json' IPC message by returning the contents of the
 * widgets.json file.
 * When the message is received, this function reads the widgets.json file
 * located in the widgets directory and returns its contents as a string.
 */
ipcMain.handle("read-widgets-json", () => {
  try {
    const widgetsData = readFileSync(widgetsJsonPath, "utf-8");
    return widgetsData;
  } catch (err) {
    console.error(`Error reading widgets.json: ${err}`);
    return null; // or handle the error as appropriate
  }
});

/**
 * Handles the 'write-widgets-json' IPC message by writing data to the widgets.json file.
 * Writes the provided data to widgets.json in the app directory and also to public/widgets/widgets.json.
 * Catches any errors writing and logs them.
 */
ipcMain.handle("write-widgets-json", async (event, data) => {
  try {
    console.log("Writing to widgets.json:", widgetsJsonPath);
    await writeFile(widgetsJsonPath, data, (err) => {
      if (err) {
        console.error(`Error writing to widgets.json: ${err}`);
        return;
      }
      console.log("Data has been written to widgets.json");
    });
  } catch (err) {
    console.error(`Error writing to widgets.json:`, err);
  }
});

/**
 * Creates the main browser window.
 * Sets up the window with default dimensions and preferences. Loads either
 * the local dev server URL or built HTML file depending on environment.
 * Also opens the DevTools for development.
 */
const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 450, // Set the initial width of the window
    height: 650, // Set the initial height of the window
    webPreferences: {
      preload: path.join(__dirname, "preload.js"), // Path to preload script
    },
    autoHideMenuBar: true, // Hide the menu bar
    titleBarStyle: "hidden", // Hide the title bar
  });

  // Load the main window content
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    // If a dev server URL is provided, load it
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    // Otherwise, load the index.html from the file system
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }
  // Open the DevTools for debugging
  // mainWindow.webContents.openDevTools();
};

/**
 * Creates windows for widgets defined in the widgets.json file.
 * Parses the widgets data and creates a BrowserWindow for each widget
 * that has the "visible" property set to true. If no "positionX" or
 * "positionY" is defined, it will generate random values and update
 * the widgets.json file.
 */
function createWindowsForWidgets() {
  try {
    // Parse the widgets JSON data
    const widgetsData: WidgetsConfig = JSON.parse(getWidgetsJson());
    if (typeof widgetsData !== "object" || Array.isArray(widgetsData)) {
      console.error("Unexpected widgets data structure:", widgetsData);
      return;
    }
    // Iterate through each widget in the data
    Object.entries(widgetsData).forEach(([key, widget]) => {
      // Check if the widget is set to be visible
      if (widget.visible) {
        // Generate random positions if none are defined
        if (!widget.positionX && !widget.positionY) {
          widget.positionX = Math.floor(Math.random() * 100);
          widget.positionY = Math.floor(Math.random() * 100);
          widgetsData[key] = widget;
          // Update the widgets.json file with new positions
          writeFileSync(
            path.join(__dirname, "/widgets/widgets.json"),
            JSON.stringify(widgetsData, null, 2)
          );
        }
        try {
          // Create a new browser window for the widget
          const win = new BrowserWindow({
            width: widget.width,
            height: widget.height,
            autoHideMenuBar: widget.autoHideMenuBar,
            titleBarStyle: widget.titleBarStyle,
            transparent: widget.transparent,
            resizable: widget.resizable,
            x: widget.positionX,
            y: widget.positionY,
            webPreferences: {
              contextIsolation: false,
              nodeIntegration: true,
            },
          });

          // Load the widget's HTML file into the window
          const indexPath = path.join(widgetsDir, key, "index.html");
          console.log(`Loading ${indexPath}`);
          win.loadFile(indexPath);
          // win.webContents.openDevTools();
        } catch (err) {
          console.error(`Error creating window for ${key}: ${err}`);
        }
      }
    });
  } catch (err) {
    console.error(`Error parsing widgets data: ${err}`);
  }
}

/**
 * Gets the widget JSON data from the widgets.json file
 * Reads the widgets.json configuration file located in the widgets directory
 * and returns its contents as a string.
 */
function getWidgetsJson() {
  try {
    const widgetsData = readFileSync(widgetsJsonPath, "utf-8");
    return widgetsData;
  } catch (error) {
    console.error("Failed to read widgets.json:", error);
    throw error; // Rethrow the error after logging it
  }
}

/**
 * Copies the widgets directory if it does not already exist.
 * Recursively copies the contents of the source widgets directory to the
 * destination widgets directory, creating any missing directories.
 * @param {string} sourceWidgetsDir - The path to the source widgets directory
 * @param {string} widgetsDir - The path to the destination widgets directory
 */
function copyWidgetsDirIfNeeded(sourceWidgetsDir: string, widgetsDir: string) {
  try {
    if (!existsSync(widgetsDir)) {
      console.log("widgets directory is not found. Copying...");

      // Create the destination directory if it doesn't exist
      mkdirSync(widgetsDir, { recursive: true });
      // Read the contents of the source directory
      const entries = readdirSync(sourceWidgetsDir, { withFileTypes: true });

      // Iterate over the contents of the source directory
      for (const entry of entries) {
        const srcPath = path.join(sourceWidgetsDir, entry.name);
        const destPath = path.join(widgetsDir, entry.name);

        // Recursively copy directories, or copy files directly
        entry.isDirectory()
          ? copyWidgetsDirIfNeeded(srcPath, destPath)
          : copyFileSync(srcPath, destPath);
        console.log(`Copied ${srcPath} to ${destPath}`);
      }
    }
  } catch (error) {
    console.error("Failed to copy widgets directory:", error);
  }
}
