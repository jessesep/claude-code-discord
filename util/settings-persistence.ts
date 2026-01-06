import { UnifiedBotSettings, UNIFIED_DEFAULT_SETTINGS } from "../settings/unified-settings.ts";

const SETTINGS_PATH = "./data/settings.json";
const DATA_DIR = "./data";

export class SettingsPersistence {
    private static instance: SettingsPersistence;
    private settings: UnifiedBotSettings;

    private constructor() {
        this.settings = { ...UNIFIED_DEFAULT_SETTINGS };
    }

    static getInstance(): SettingsPersistence {
        if (!SettingsPersistence.instance) {
            SettingsPersistence.instance = new SettingsPersistence();
        }
        return SettingsPersistence.instance;
    }

    async load(): Promise<UnifiedBotSettings> {
        try {
            await Deno.mkdir(DATA_DIR, { recursive: true });
            const data = await Deno.readTextFile(SETTINGS_PATH);
            const fileSettings = JSON.parse(data);
            // Merge with defaults to ensure new fields are present
            this.settings = { ...UNIFIED_DEFAULT_SETTINGS, ...fileSettings };
            console.log("Settings loaded from", SETTINGS_PATH);
        } catch (error) {
            if (error instanceof Deno.errors.NotFound) {
                console.log("No settings file found, creating new one.");
                await this.save();
            } else {
                console.error("Error loading settings:", error);
            }
        }
        return this.settings;
    }

    async save(settings?: UnifiedBotSettings): Promise<void> {
        if (settings) {
            this.settings = settings;
        }
        try {
            await Deno.mkdir(DATA_DIR, { recursive: true });
            await Deno.writeTextFile(SETTINGS_PATH, JSON.stringify(this.settings, null, 2));
            console.log("Settings saved to", SETTINGS_PATH);
        } catch (error) {
            console.error("Error saving settings:", error);
        }
    }

    getSettings(): UnifiedBotSettings {
        return this.settings;
    }
}
