"use strict";

var libQ = require("kew");
var fs = require("fs");
var path = require("path");

module.exports = ControllerUsbAutoplay;

function ControllerUsbAutoplay(context) {
    this.context = context;
    this.commandRouter = this.context.coreCommand;
    this.logger = this.context.logger;
    this.configManager = this.context.configManager;
    this.runtimeConfigPath = "/data/configuration/system_controller/usb_autoplay_plugin/usb-autoplay-runtime.conf";
}

ControllerUsbAutoplay.prototype.onVolumioStart = function () {
    var configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, "config.json");
    this.config = new (require("v-conf"))();
    this.config.loadFile(configFile);
    return libQ.resolve();
};

ControllerUsbAutoplay.prototype.onStart = function () {
    var defer = libQ.defer();
    this.logger.info("[USB Autoplay] Plugin started. udev/systemd trigger uses Volumio REST API.");
    this.writeRuntimeConfig();
    defer.resolve();
    return defer.promise;
};

ControllerUsbAutoplay.prototype.onStop = function () {
    var defer = libQ.defer();
    this.logger.info("[USB Autoplay] Plugin stopped. Autoplay script will exit because ENABLED=0.");
    this.writeRuntimeConfigWithEnabled(false);
    defer.resolve();
    return defer.promise;
};

ControllerUsbAutoplay.prototype.onRestart = function () { this.logger.info("[USB Autoplay] Restarting plugin"); };
ControllerUsbAutoplay.prototype.getConfigurationFiles = function () { return ["config.json"]; };

ControllerUsbAutoplay.prototype.getUIConfig = function () {
    var defer = libQ.defer();
    var self = this;
    var langCode = this.commandRouter.sharedVars.get("language_code");
    self.commandRouter.i18nJson(__dirname + "/i18n/strings_" + langCode + ".json", __dirname + "/i18n/strings_en.json", __dirname + "/UIConfig.json")
    .then(function (uiconf) {
        uiconf.sections[0].content[0].value = self.config.get("enabled");
        uiconf.sections[0].content[1].value = self.config.get("usbUri");
        uiconf.sections[0].content[2].value = self.config.get("random");
        uiconf.sections[0].content[3].value = self.config.get("repeat");
        uiconf.sections[0].content[4].value = self.config.get("killPulseAudio");
        defer.resolve(uiconf);
    })
    .fail(function (e) { self.logger.error("[USB Autoplay] Error loading UI config: " + e.message); defer.reject(e); });
    return defer.promise;
};

ControllerUsbAutoplay.prototype.saveSettings = function (data) {
    var defer = libQ.defer();
    try {
        this.config.set("enabled", this.boolFromUi(data.enabled));
        this.config.set("usbUri", this.stringFromUi(data.usbUri, "music-library/USB"));
        this.config.set("random", this.boolFromUi(data.random));
        this.config.set("repeat", this.boolFromUi(data.repeat));
        this.config.set("killPulseAudio", this.boolFromUi(data.killPulseAudio));
        this.writeRuntimeConfig();
        this.commandRouter.pushToastMessage("success", "USB Autoplay", "Settings saved");
        defer.resolve();
    } catch (e) {
        this.logger.error("[USB Autoplay] Error saving settings: " + e.message);
        this.commandRouter.pushToastMessage("error", "USB Autoplay", "Error saving settings");
        defer.reject(e);
    }
    return defer.promise;
};

ControllerUsbAutoplay.prototype.writeRuntimeConfig = function () { this.writeRuntimeConfigWithEnabled(this.config.get("enabled")); };
ControllerUsbAutoplay.prototype.writeRuntimeConfigWithEnabled = function (enabled) {
    var content = "";
    content += "ENABLED=" + (enabled ? "1" : "0") + "\n";
    content += "USB_URI=" + this.shellString(this.config.get("usbUri") || "music-library/USB") + "\n";
    content += "RANDOM_PLAY=" + (this.config.get("random") ? "1" : "0") + "\n";
    content += "REPEAT_PLAY=" + (this.config.get("repeat") ? "1" : "0") + "\n";
    content += "KILL_PULSEAUDIO=" + (this.config.get("killPulseAudio") ? "1" : "0") + "\n";
    content += "MAX_WAIT_API=60\nMAX_WAIT_USB=120\n";
    try { fs.mkdirSync(path.dirname(this.runtimeConfigPath), { recursive: true }); fs.writeFileSync(this.runtimeConfigPath, content, "utf8"); this.logger.info("[USB Autoplay] Runtime config written to " + this.runtimeConfigPath); }
    catch (e) { this.logger.error("[USB Autoplay] Could not write runtime config: " + e.message); }
};
ControllerUsbAutoplay.prototype.shellString = function (value) { return '"' + String(value).replace(/(["\\$`])/g, "\\$1") + '"'; };
ControllerUsbAutoplay.prototype.boolFromUi = function (value) { if (value && typeof value === "object" && value.value !== undefined) { return !!value.value; } return !!value; };
ControllerUsbAutoplay.prototype.stringFromUi = function (value, fallback) { if (value && typeof value === "object" && value.value !== undefined) { value = value.value; } value = String(value || "").trim(); return value.length > 0 ? value : fallback; };
