// types.d.ts
declare global {
  interface WidgetConfig {
    title: string;
    visible: boolean;
    created_at: string;
    updated_at: string;
    creator: string;
    width: number;
    height: number;
    autoHideMenuBar: boolean;
    titleBarStyle: "default" | "hidden" | "customButtonsOnHover";
    transparent: boolean;
    resizable: boolean;
    positionX?: number;
    positionY?: number;
  }

  // Assuming widgetsData is an object where each key is a string and the value is a WidgetConfig
  interface WidgetsConfig {
    [key: string]: WidgetConfig;
  }
}

export interface IElectronAPI {
  minimizeWindow(): () => Promise<void>;
  closeWindow(): () => Promise<void>;
  openExternalLink(url): () => Promise<void>;
  readWidgetsJson(): () => Promise<WidgetsConfig>;
}
declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}

export {};
