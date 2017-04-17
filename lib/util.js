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
//# sourceMappingURL=util.js.map