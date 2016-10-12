"use strict";
var Promise = require('bluebird');
var _ = require('lodash');
var child_process_1 = require('child_process');
var parser_1 = require('./parser');
var rectifier_1 = require('./parser/stream/rectifier');
var handler_1 = require('./handler');
var error_1 = require('./error');
var Action = require('./view/actions');
var semver = require('semver');
Promise.longStackTraces();
var Process = (function () {
    function Process(core) {
        var _this = this;
        this.core = core;
        this.validateExecutablePath = function (path) {
            return new Promise(function (resolve, reject) {
                path = parser_1.parseFilepath(path) || '';
                if (path === '') {
                    reject(new error_1.InvalidExecutablePathError("Path must not be empty", path));
                }
                else {
                    try {
                        var args = _this.getProgramArgs();
                        args.push('-V');
                        var agdaProcess = child_process_1.spawn(path, args);
                        agdaProcess.on('error', function (error) {
                            reject(new error_1.InvalidExecutablePathError("unable to spawn Agda process", path));
                        });
                        agdaProcess.stderr.once('data', function (data) {
                            var message = "Spawned process returned with the following result (from stderr):\n\"" + data.toString() + "\"";
                            reject(new error_1.InvalidExecutablePathError(message, path));
                        });
                        agdaProcess.stdout.once('data', function (data) {
                            var result = data.toString().match(/^Agda version (.*)(?:\r\n?|\n)$/);
                            if (result) {
                                var rawVerNum = result[1];
                                var semVerNum = _.take((result[1] + '.0.0.0').split('.'), 3).join('.');
                                _this.agdaVersion = {
                                    raw: rawVerNum,
                                    sem: semVerNum
                                };
                                atom.config.set('agda-mode.executablePath', path);
                                resolve(path);
                            }
                            else {
                                var message = "Spawned process returned with the following result (from stdout):\n\"" + data.toString() + "\"";
                                reject(new error_1.InvalidExecutablePathError(message, path));
                            }
                        });
                    }
                    catch (error) {
                        reject(new error_1.InvalidExecutablePathError(error.toString(), path));
                    }
                }
            });
        };
        this.sendCommand = function (highlightingLevel, interaction) {
            var filepath = _this.core.getPath();
            var highlightingMethod = atom.config.get('agda-mode.highlightingMethod');
            var command;
            if (typeof interaction === 'string') {
                command = "IOTCM \"" + filepath + "\" " + highlightingLevel + " " + highlightingMethod + " ( " + interaction + " )\n";
            }
            else {
                command = "IOTCM \"" + filepath + "\" " + highlightingLevel + " " + highlightingMethod + " ( " + interaction() + " )\n";
            }
            if (atom.inDevMode()) {
                _this.core.view.store.dispatch(Action.devAddRequest(command));
            }
            _this.agdaProcess.stdin.write(command);
            return Promise.resolve(_this.agdaProcess);
        };
        this.load = function () {
            return _this.wireAgdaProcess().then(function (agdaProcess) {
                _this.agdaProcess = agdaProcess;
                _this.agdaProcessWired = true;
                _this.core.textBuffer.saveBuffer();
                return _this.sendCommand('NonInteractive', function () {
                    if (semver.gte(_this.agdaVersion.sem, '2.5.0'))
                        return "Cmd_load \"" + _this.core.getPath() + "\" []";
                    else
                        return "Cmd_load \"" + _this.core.getPath() + "\" [" + _this.getLibraryPath() + "]";
                });
            }).catch(error_1.ProcExecError, function (error) {
                _this.queryExecutablePathUntilSuccess(error);
            }).catch(error_1.AgdaParseError, function (error) {
                var args = _this.getProgramArgs();
                args.push('-V');
                _this.core.view.set('Agda Parse Error', [
                    ("Arguments passed to Agda: \"" + args.join(' ') + "\""),
                    "Message from agda:"
                ].concat(error.message), 3);
            });
        };
        this.quit = function () {
            _this.agdaProcess.kill();
            _this.agdaProcessWired = false;
            return Promise.resolve();
        };
        this.info = function () {
            var path = atom.config.get('agda-mode.executablePath');
            var args = _this.getProgramArgs();
            args.push('--interaction');
            var agdaVersion = _this.agdaVersion ? _this.agdaVersion.raw : 'null';
            _this.core.view.set('Info', [
                ("Agda version: " + agdaVersion),
                ("Agda executable path: " + path),
                ("Agda executable arguments: " + args.join(' '))
            ], 0);
            return Promise.resolve();
        };
        this.compile = function () {
            var backend = atom.config.get('agda-mode.backend');
            return _this.sendCommand('NonInteractive', function () {
                if (semver.gte(_this.agdaVersion.sem, '2.5.0'))
                    return "Cmd_compile " + backend + " \"" + _this.core.getPath() + "\" []";
                else
                    return "Cmd_compile " + backend + " \"" + _this.core.getPath() + "\" [" + _this.getLibraryPath() + "]";
            });
        };
        this.toggleDisplayOfImplicitArguments = function () {
            return _this.sendCommand('NonInteractive', 'ToggleImplicitArgs');
        };
        this.solveConstraints = function () {
            return _this.sendCommand('NonInteractive', 'Cmd_solveAll');
        };
        this.showConstraints = function () {
            return _this.sendCommand('NonInteractive', 'Cmd_constraints');
        };
        this.showGoals = function () {
            return _this.sendCommand('NonInteractive', 'Cmd_metas');
        };
        this.whyInScope = function (expr, goal) {
            if (goal) {
                return _this.sendCommand('NonInteractive', "Cmd_why_in_scope " + goal.index + " noRange \"" + expr + "\"");
            }
            else {
                return _this.sendCommand('None', "Cmd_why_in_scope_toplevel \"" + expr + "\"");
            }
        };
        this.inferType = function (normalization, goal) {
            return function (expr) {
                if (goal) {
                    return _this.sendCommand('NonInteractive', "Cmd_infer " + normalization + " " + goal.index + " noRange \"" + expr + "\"");
                }
                else {
                    return _this.sendCommand('None', "Cmd_infer_toplevel " + normalization + " \"" + expr + "\"");
                }
            };
        };
        this.moduleContents = function (normalization, expr) {
            return function (goal) {
                if (goal) {
                    return _this.sendCommand('NonInteractive', "Cmd_show_module_contents " + normalization + " " + goal.index + " noRange \"" + expr + "\"");
                }
                else {
                    return _this.sendCommand('None', "Cmd_show_module_contents_toplevel " + normalization + " \"" + expr + "\"");
                }
            };
        };
        this.computeNormalForm = function (goal) {
            return function (expr) {
                if (goal) {
                    return _this.sendCommand('NonInteractive', "Cmd_compute False " + goal.index + " noRange \"" + expr + "\"");
                }
                else {
                    return _this.sendCommand('None', "Cmd_compute_toplevel False \"" + expr + "\"");
                }
            };
        };
        this.computeNormalFormIgnoreAbstract = function (goal) {
            return function (expr) {
                if (goal) {
                    return _this.sendCommand('NonInteractive', "Cmd_compute True " + goal.index + " noRange \"" + expr + "\"");
                }
                else {
                    return _this.sendCommand('None', "Cmd_compute_toplevel True \"" + expr + "\"");
                }
            };
        };
        this.give = function (goal) {
            return _this.sendCommand('NonInteractive', "Cmd_give " + goal.index + " " + _this.buildRange(goal) + " \"" + goal.getContent() + "\"");
        };
        this.refine = function (goal) {
            return _this.sendCommand('NonInteractive', "Cmd_refine_or_intro False " + goal.index + " " + _this.buildRange(goal) + " \"" + goal.getContent() + "\"");
        };
        this.auto = function (goal) {
            return _this.sendCommand('NonInteractive', "Cmd_auto " + goal.index + " " + _this.buildRange(goal) + " \"" + goal.getContent() + "\"");
        };
        this['case'] = function (goal) {
            return _this.sendCommand('NonInteractive', "Cmd_make_case " + goal.index + " " + _this.buildRange(goal) + " \"" + goal.getContent() + "\"");
        };
        this.goalType = function (normalization) {
            return function (goal) {
                return _this.sendCommand('NonInteractive', "Cmd_goal_type " + normalization + " " + goal.index + " noRange \"\"");
            };
        };
        this.context = function (normalization) {
            return function (goal) {
                return _this.sendCommand('NonInteractive', "Cmd_context " + normalization + " " + goal.index + " noRange \"\"");
            };
        };
        this.goalTypeAndContext = function (normalization) {
            return function (goal) {
                return _this.sendCommand('NonInteractive', "Cmd_goal_type_context " + normalization + " " + goal.index + " noRange \"\"");
            };
        };
        this.goalTypeAndInferredType = function (normalization) {
            return function (goal) {
                return _this.sendCommand('NonInteractive', "Cmd_goal_type_context_infer " + normalization + " " + goal.index + " noRange \"" + goal.getContent() + "\"");
            };
        };
    }
    Process.prototype.getLibraryPath = function () {
        var path = atom.config.get('agda-mode.libraryPath');
        path.unshift('.');
        return path.map(function (p) { return "\"" + parser_1.parseFilepath(p) + "\""; }).join(', ');
    };
    Process.prototype.getProgramArgs = function () {
        var args = atom.config.get('agda-mode.programArgs');
        return _.compact(args.split(' '));
    };
    Process.prototype.queryExecutablePathUntilSuccess = function (error) {
        var _this = this;
        var name;
        var message;
        var type;
        var placeholder;
        if (error instanceof error_1.AutoExecPathSearchError) {
            name = "Automatic executable path searching failed";
            message = [
                ("searching for: \"" + error.programName + "\" in the environment")
            ].concat(_.compact(error.message.split('\n')));
            type = 4;
            placeholder = 'please enter the path by manual or change the settings again';
        }
        else if (error instanceof error_1.ProcExecError) {
            name = "Process execution error";
            message = error.message.split('\n');
            type = 4;
            placeholder = 'please enter the path by manual or change the settings again';
        }
        else if (error instanceof error_1.InvalidExecutablePathError) {
            name = "Invalid executable path";
            message = [("Path: " + error.path)].concat(error.message.split('\n'));
            type = 3;
            placeholder = 'try another path';
        }
        return this.core.view.query(name, message, type, placeholder, false)
            .then(this.validateExecutablePath)
            .then(function (path) {
            atom.config.set('agda-mode.executablePath', path);
            return path;
        })
            .catch(error_1.InvalidExecutablePathError, function (error) { return _this.queryExecutablePathUntilSuccess(error); });
    };
    Process.prototype.getExecutablePath = function () {
        var _this = this;
        if (atom.config.get('agda-mode.autoSearchPath')) {
            return this.getPathFromSettings()
                .catch(error_1.InvalidExecutablePathError, function () { return _this.autoGetPath(); })
                .catch(function (error) { return _this.queryExecutablePathUntilSuccess(error); });
        }
        else {
            return this.getPathFromSettings()
                .catch(function (error) { return _this.queryExecutablePathUntilSuccess(error); });
        }
    };
    Process.prototype.getPathFromSettings = function () {
        var path = atom.config.get('agda-mode.executablePath');
        return this.validateExecutablePath(path);
    };
    Process.prototype.autoGetPath = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var onWindows = process.platform === 'win32';
            var programName = atom.config.get('agda-mode.programName');
            if (onWindows) {
                reject(new error_1.AutoExecPathSearchError('', programName));
            }
            else {
                child_process_1.exec("which " + programName, function (error, stdout, stderr) {
                    if (error) {
                        reject(new error_1.AutoExecPathSearchError(error.toString(), programName));
                    }
                    else {
                        resolve(_this.validateExecutablePath(stdout));
                    }
                });
            }
        });
    };
    Process.prototype.wireAgdaProcess = function () {
        var _this = this;
        if (this.agdaProcessWired) {
            return Promise.resolve(this.agdaProcess);
        }
        else {
            return this.getExecutablePath()
                .then(function (path) {
                return new Promise(function (resolve, reject) {
                    var args = _this.getProgramArgs();
                    args.push('--interaction');
                    var agdaProcess = child_process_1.spawn(path, args);
                    agdaProcess.on('error', function (error) {
                        reject(new error_1.ProcExecError(error.message));
                    });
                    agdaProcess.on('close', function (signal) {
                        reject(new error_1.ProcExecError("exit with signal " + signal));
                    });
                    agdaProcess.stdout.once('data', function (data) {
                        var result = data.toString().match(/^A/);
                        if (result) {
                            _this.agdaProcessWired = true;
                            _this.agdaProcess = agdaProcess;
                            resolve(agdaProcess);
                        }
                        else {
                            reject(new error_1.AgdaParseError(data.toString()));
                        }
                    });
                    agdaProcess.stdout
                        .pipe(new rectifier_1.default)
                        .on('data', function (data) {
                        try {
                            if (atom.inDevMode()) {
                                _this.core.view.store.dispatch(Action.devAddResponse(data));
                            }
                            var response = parser_1.parseAgdaResponse(data);
                            handler_1.handleAgdaResponse(_this.core, response);
                        }
                        catch (error) {
                            console.log(error);
                            _this.core.view.set('Agda Parse Error', ["Message from agda:"].concat(data.toString()), 3);
                        }
                    });
                });
            });
        }
    };
    Process.prototype.buildRange = function (goal) {
        var start = goal.range.start;
        var startIndex = this.core.editor.toIndex(start);
        var end = goal.range.end;
        var endIndex = this.core.editor.toIndex(end);
        if (semver.gte(this.agdaVersion.sem, '2.5.1')) {
            return "(intervalsToRange (Just (mkAbsolute \"" + this.core.getPath() + "\")) [Interval (Pn () " + (startIndex + 3) + " " + (start.row + 1) + " " + (start.column + 3) + ") (Pn () " + (endIndex - 1) + " " + (end.row + 1) + " " + (end.column - 1) + ")])";
        }
        else {
            return "(Range [Interval (Pn (Just (mkAbsolute \"" + this.core.getPath() + "\")) " + (startIndex + 3) + " " + (start.row + 1) + " " + (start.column + 3) + ") (Pn (Just (mkAbsolute \"" + this.core.getPath() + "\")) " + (endIndex - 1) + " " + (end.row + 1) + " " + (end.column - 1) + ")])";
        }
    };
    return Process;
}());
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Process;
//# sourceMappingURL=process.js.map