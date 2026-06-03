"use strict";

var libQ = require("kew");
var exec = require("child_process").exec;

module.exports = ControllerUsbAutoplay;

function ControllerUsbAutoplay(context) {
    this.context = context;
    this.commandRouter = this.context.coreCommand;
    this.logger = this.context.logger;
    this.configManager = this.context.configManager;
    this.pollTimer = null;
    this.isRunningAutoplay = false;
    this.lastUsbAvailable = false;
}

ControllerUsbAutoplay.prototype.onVolumioStart = function () {
    var configFile = this.commandRouter.pluginManager.getConfigurationFile(this.context, "config.json");
    this.config = new (require("v-conf"))();
    this.config.loadFile(configFile);
    return libQ.resolve();
};

ControllerUsbAutoplay.prototype.onStart = function () {
    var self = this;
    var defer = libQ.defer();
    self.logger.info("[USB Autoplay] Starting plugin");
    self.startPolling();
    setTimeout(function () {
        self.checkUsbAndAutoplay(true);
    }, 5000);
    defer.resolve();
    return defer.promise;
};

ControllerUsbAutoplay.prototype.onStop = function () {
    var defer = libQ.defer();
    this.logger.info("[USB Autoplay] Stopping plugin");
    if (this.pollTimer) {
        clearInterval(this.pollTimer);
        this.pollTimer = null;
    }
    defer.resolve();
    return defer.promise;
};

ControllerUsbAutoplay.prototype.onRestart = function () {
    this.logger.info("[USB Autoplay] Restarting plugin");
};

ControllerUsbAutoplay.prototype.getConfigurationFiles = function () {
    return ["config.json"];
};

ControllerUsbAutoplay.prototype.getUIConfig = function () {
    var defer = libQ.defer();
    var self = this;
    var langCode = this.commandRouter.sharedVars.get("language_code");

    self.commandRouter.i18nJson(
        __dirname + "/i18n/strings_" + langCode + ".json",
        __dirname + "/i18n/strings_en.json",
        __dirname + "/UIConfig.json"
    )
    .then(function (uiconf) {
        uiconf.sections[0].content[0].value = self.config.get("enabled");
        uiconf.sections[0].content[1].value = self.config.get("usbPath");
        uiconf.sections[0].content[2].value = self.config.get("random");
        uiconf.sections[0].content[3].value = self.config.get("repeat");
        uiconf.sections[0].content[4].value = self.config.get("forcePlayback");
        uiconf.sections[0].content[5].value = String(self.config.get("pollIntervalSeconds"));
        defer.resolve(uiconf);
    })
    .fail(function (e) {
        self.logger.error("[USB Autoplay] Error loading UI config: " + e.message);
        defer.reject(e);
    });

    return defer.promise;
};

ControllerUsbAutoplay.prototype.saveSettings = function (data) {
    var self = this;
    var defer = libQ.defer();

    try {
        self.config.set("enabled", self.boolFromUi(data.enabled));
        self.config.set("usbPath", self.stringFromUi(data.usbPath, "USB"));
        self.config.set("random", self.boolFromUi(data.random));
        self.config.set("repeat", self.boolFromUi(data.repeat));
        self.config.set("forcePlayback", self.boolFromUi(data.forcePlayback));
        self.config.set("pollIntervalSeconds", self.numberFromUi(data.pollIntervalSeconds, 10));
        self.commandRouter.pushToastMessage("success", "USB Autoplay", "Settings saved");
        self.restartPolling();
        defer.resolve();
    } catch (e) {
        self.logger.error("[USB Autoplay] Error saving settings: " + e.message);
        self.commandRouter.pushToastMessage("error", "USB Autoplay", "Error saving settings");
        defer.reject(e);
    }

    return defer.promise;
};

ControllerUsbAutoplay.prototype.startPolling = function () {
    var self = this;
    if (self.pollTimer) {
        clearInterval(self.pollTimer);
        self.pollTimer = null;
    }
    var intervalSeconds = self.config.get("pollIntervalSeconds") || 10;
    var intervalMs = Math.max(5, intervalSeconds) * 1000;
    self.logger.info("[USB Autoplay] Polling interval: " + intervalSeconds + " seconds");
    self.pollTimer = setInterval(function () {
        self.checkUsbAndAutoplay(false);
    }, intervalMs);
};

ControllerUsbAutoplay.prototype.restartPolling = function () {
    this.lastUsbAvailable = false;
    this.startPolling();
    this.checkUsbAndAutoplay(true);
};

ControllerUsbAutoplay.prototype.checkUsbAndAutoplay = function (forceCheck) {
    var self = this;
    if (!self.config.get("enabled")) {
        return;
    }
    var usbPath = self.config.get("usbPath") || "USB";
    self.hasUsbContent(usbPath)
        .then(function (available) {
            if (available && (!self.lastUsbAvailable || forceCheck)) {
                self.logger.info("[USB Autoplay] USB content detected at " + usbPath);
                self.lastUsbAvailable = true;
                self.runAutoplay();
            } else if (!available) {
                self.lastUsbAvailable = false;
            }
        })
        .fail(function (err) {
            self.logger.error("[USB Autoplay] USB check error: " + err.message);
        });
};

ControllerUsbAutoplay.prototype.runAutoplay = function () {
    var self = this;
    if (self.isRunningAutoplay) {
        self.logger.info("[USB Autoplay] Autoplay already running, skipping");
        return;
    }
    self.isRunningAutoplay = true;

    var usbPath = self.config.get("usbPath") || "USB";
    var random = self.config.get("random") ? "on" : "off";
    var repeat = self.config.get("repeat") ? "on" : "off";
    var forcePlayback = self.config.get("forcePlayback");

    self.logger.info("[USB Autoplay] Starting autoplay sequence");

    self.waitForMpd()
        .then(function () { return self.execCommand("mpc update"); })
        .then(function () { return self.waitForUsbContent(usbPath); })
        .then(function () {
            if (forcePlayback) {
                return self.execCommand("mpc stop || true");
            }
            return libQ.resolve();
        })
        .then(function () { return self.execCommand("mpc clear"); })
        .then(function () { return self.execCommand("mpc add " + self.shellQuote(usbPath)); })
        .then(function () { return self.execCommand("mpc random " + random); })
        .then(function () { return self.execCommand("mpc repeat " + repeat); })
        .then(function () { return self.execCommand("mpc single off"); })
        .then(function () { return self.execCommand("mpc consume off"); })
        .then(function () { return self.execCommand("mpc play"); })
        .then(function () {
            self.logger.info("[USB Autoplay] Autoplay started successfully");
            self.commandRouter.pushToastMessage("success", "USB Autoplay", "USB playback started");
        })
        .fail(function (err) {
            self.logger.error("[USB Autoplay] Autoplay error: " + err.message);
            self.commandRouter.pushToastMessage("error", "USB Autoplay", "Autoplay error: " + err.message);
        })
        .fin(function () {
            self.isRunningAutoplay = false;
        });
};

ControllerUsbAutoplay.prototype.waitForMpd = function () {
    var self = this;
    var defer = libQ.defer();
    var maxWait = self.config.get("maxWaitMpdSeconds") || 60;
    var elapsed = 0;

    function check() {
        self.execCommand("mpc status")
            .then(function () {
                self.logger.info("[USB Autoplay] MPD ready");
                defer.resolve();
            })
            .fail(function () {
                elapsed += 2;
                if (elapsed >= maxWait) {
                    defer.reject(new Error("Timeout waiting for MPD"));
                } else {
                    setTimeout(check, 2000);
                }
            });
    }

    check();
    return defer.promise;
};

ControllerUsbAutoplay.prototype.waitForUsbContent = function (usbPath) {
    var self = this;
    var defer = libQ.defer();
    var maxWait = self.config.get("maxWaitUsbSeconds") || 120;
    var elapsed = 0;

    function check() {
        self.hasUsbContent(usbPath)
            .then(function (available) {
                if (available) {
                    defer.resolve();
                } else {
                    elapsed += 2;
                    if (elapsed >= maxWait) {
                        defer.reject(new Error("Timeout waiting for USB content at " + usbPath));
                    } else {
                        setTimeout(check, 2000);
                    }
                }
            });
    }

    check();
    return defer.promise;
};

ControllerUsbAutoplay.prototype.hasUsbContent = function (usbPath) {
    var self = this;
    var defer = libQ.defer();

    self.execCommand("mpc listall " + self.shellQuote(usbPath))
        .then(function (stdout) {
            defer.resolve(!!(stdout && stdout.trim().length > 0));
        })
        .fail(function () {
            defer.resolve(false);
        });

    return defer.promise;
};

ControllerUsbAutoplay.prototype.execCommand = function (cmd) {
    var self = this;
    var defer = libQ.defer();

    self.logger.info("[USB Autoplay] exec: " + cmd);

    exec(cmd, { timeout: 30000 }, function (error, stdout, stderr) {
        if (error) {
            self.logger.error("[USB Autoplay] command failed: " + cmd + " | " + error.message);
            if (stderr) {
                self.logger.error("[USB Autoplay] stderr: " + stderr);
            }
            defer.reject(error);
            return;
        }
        if (stderr) {
            self.logger.info("[USB Autoplay] stderr: " + stderr);
        }
        defer.resolve(stdout || "");
    });

    return defer.promise;
};

ControllerUsbAutoplay.prototype.shellQuote = function (value) {
    return '"' + String(value).replace(/(["\\$`])/g, "\\$1") + '"';
};

ControllerUsbAutoplay.prototype.boolFromUi = function (value) {
    if (value && typeof value === "object" && value.value !== undefined) {
        return !!value.value;
    }
    return !!value;
};

ControllerUsbAutoplay.prototype.stringFromUi = function (value, fallback) {
    if (value && typeof value === "object" && value.value !== undefined) {
        value = value.value;
    }
    value = String(value || "").trim();
    return value.length > 0 ? value : fallback;
};

ControllerUsbAutoplay.prototype.numberFromUi = function (value, fallback) {
    if (value && typeof value === "object" && value.value !== undefined) {
        value = value.value;
    }
    var n = parseInt(value, 10);
    return isNaN(n) ? fallback : n;
};
