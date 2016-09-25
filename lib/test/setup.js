"use strict";
// courtesy of @jccguimaraes, https://gist.github.com/jccguimaraes/2e08be6f549448d9361c
var path = require('path');
var util = require('util');
var electron_1 = require('electron');
// import * as Mocha from 'mocha';
var Promise = require('bluebird');
var Mocha = require('mocha');
module.exports = function (args) {
    var promise = new Promise(function (resolve, reject) {
        // constructs a headless Atom
        window['atom'] = args.buildAtomEnvironment({
            applicationDelegate: args.buildDefaultApplicationDelegate(),
            window: window,
            document: document,
            configDirPath: process.env.ATOM_HOME,
            enablePersistence: false
        });
        var testPath = path.join(__dirname, 'test');
        // using Mocha programatically
        var mocha = new Mocha;
        Mocha.utils
            .lookupFiles(testPath, ['js'], true)
            .forEach(mocha.addFile.bind(mocha));
        if (args.headless) {
            // redirect console.log to stdout
            console.log = function () {
                var args = [];
                for (var _i = 0; _i < arguments.length; _i++) {
                    args[_i - 0] = arguments[_i];
                }
                if (args.length > 0) {
                    var format = args[0], rest = args.slice(1);
                    var formatted = util.format.apply(util, [format].concat(rest));
                    process.stdout.write(formatted + '\n');
                }
            };
            Object.defineProperties(process, {
                stdout: { value: electron_1.remote.process.stdout },
                stderr: { value: electron_1.remote.process.stderr }
            });
        }
        // run!
        var runner = mocha.run(function (failure) {
            resolve(failure);
        });
    });
    // catch and report errors occured in test scripts!
    promise.catch(function (error) {
        // `error` is an instance of `Error`
        console.dir(error);
        // I don't know if there's other way to tell whether the spec was
        // invoked from the editor, or ran in console, but ::isMaximized() seems do just fine
        if (window['atom'].isMaximized()) {
        }
        else {
            // spec probably runs in console
            process.exit(1); // do something to quit the process, or it HANGS!
        }
    });
    return promise;
};
//
// describe 'activating agda-mode', ->
//
//     textEditor_ = null
//
//     beforeEach ->
//         atom.packages.deactivatePackage('agda-mode')
//         atom.packages.activatePackage('agda-mode')
//         return
//
//     it 'should be activated after triggering 'agda-mode:load' in .agda files', (done) ->
//         openFile agdaFD
//             .then (textEditor) ->
//                 element = atom.views.getView(textEditor)
//                 atom.commands.dispatch(element, 'agda-mode:load')
//                 textEditor_ = textEditor
//                 return atom.packages.activatePackage('agda-mode')
//             .then ->
//                 getActivePackageNames().should.contain 'agda-mode'
//                 textEditor_.core.should.be.defined
//                 done()
//
//     it 'should be activated after triggering 'agda-mode:load' in .lagda files', (done) ->
//         openFile lagdaFD
//             .then (textEditor) ->
//                 element = atom.views.getView(textEditor)
//                 atom.commands.dispatch(element, 'agda-mode:load')
//                 textEditor_ = textEditor
//                 return atom.packages.activatePackage('agda-mode')
//             .then ->
//                 getActivePackageNames().should.contain 'agda-mode'
//                 textEditor_.core.should.be.defined
//                 done()
//
//     it 'should be activated after triggering 'agda-mode:input-symbol' in .agda files', (done) ->
//         openFile agdaFD
//             .then (textEditor) ->
//                 element = atom.views.getView(textEditor)
//                 atom.commands.dispatch(element, 'agda-mode:input-symbol')
//                 textEditor_ = textEditor
//                 return atom.packages.activatePackage('agda-mode')
//             .then ->
//                 getActivePackageNames().should.contain 'agda-mode'
//                 textEditor_.core.should.be.defined
//                 done()
//
//     it 'should be activated after triggering 'agda-mode:input-symbol' in .lagda files', (done) ->
//         openFile lagdaFD
//             .then (textEditor) ->
//                 element = atom.views.getView(textEditor)
//                 atom.commands.dispatch(element, 'agda-mode:input-symbol')
//                 textEditor_ = textEditor
//                 return atom.packages.activatePackage('agda-mode')
//             .then ->
//                 getActivePackageNames().should.contain 'agda-mode'
//                 textEditor_.core.should.be.defined
//                 done()
//# sourceMappingURL=setup.js.map