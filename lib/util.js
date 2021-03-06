"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// http://stackoverflow.com/a/2117523
function guid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
exports.guid = guid;
// http://werxltd.com/wp/2010/05/13/javascript-implementation-of-javas-string-hashcode-method/
function hash(o) {
    const s = JSON.stringify(o);
    var hash = 0;
    if (s.length == 0)
        return hash.toString();
    for (var i = 0; i < s.length; i++) {
        hash = ((hash << 5) - hash) + s.charCodeAt(i);
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString();
}
exports.hash = hash;
class TelePromise {
    // extracts resolve/reject from a new Promise,
    //  usage:
    //      new Promise(someTelePromise.wire());
    wire() {
        return (resolve, reject) => {
            this.resolver = resolve;
            this.rejecter = reject;
        };
    }
    resolve(result) {
        if (this.resolver) {
            this.resolver(result);
            this.cleanup();
        }
    }
    reject(error) {
        if (this.rejecter) {
            this.rejecter(error);
            this.cleanup();
        }
    }
    cleanup() {
        this.resolver = undefined;
        this.rejecter = undefined;
    }
}
exports.TelePromise = TelePromise;
//# sourceMappingURL=util.js.map