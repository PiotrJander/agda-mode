"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const React = require("react");
const react_redux_1 = require("react-redux");
const classNames = require("classnames");
const Action = require("../actions");
var { CompositeDisposable } = require('atom');
const mapStateToProps = (state) => ({
    mountingPosition: state.view.mountAt.current,
    settingsView: state.view.settingsView
});
const mapDispatchToProps = (dispatch) => ({
    handleMountAtPane: () => {
        dispatch(Action.mountAtPane());
    },
    handleMountAtBottom: () => {
        dispatch(Action.mountAtBottom());
    },
    handleToggleSettingsView: () => {
        dispatch(Action.toggleSettingsView());
    }
});
class Dashboard extends React.Component {
    constructor() {
        super();
        this.subscriptions = new CompositeDisposable;
    }
    componentDidMount() {
        this.subscriptions.add(atom.tooltips.add(this.toggleSettingsViewButton, {
            title: 'settings',
            delay: 100
        }));
        this.subscriptions.add(atom.tooltips.add(this.toggleMountingPositionButton, {
            title: 'toggle panel docking position',
            delay: 300,
            keyBindingCommand: 'agda-mode:toggle-docking'
        }));
    }
    componentWillUnmount() {
        this.subscriptions.dispose();
    }
    render() {
        const { mountingPosition, settingsView } = this.props;
        const { mountAtPane, mountAtBottom, toggleSettingsView } = this.props;
        const { handleMountAtPane, handleMountAtBottom, handleToggleSettingsView } = this.props;
        const settingsViewClassList = classNames({
            activated: settingsView,
        }, 'no-btn');
        const toggleMountingPosition = classNames({
            activated: mountingPosition === 0 /* Pane */
        }, 'no-btn');
        return (React.createElement("ul", { className: "agda-dashboard" },
            React.createElement("li", null,
                React.createElement("button", { className: settingsViewClassList, onClick: () => {
                        handleToggleSettingsView();
                        toggleSettingsView();
                    }, ref: (ref) => {
                        this.toggleSettingsViewButton = ref;
                    } },
                    React.createElement("span", { className: "icon icon-settings" }))),
            React.createElement("li", null,
                React.createElement("button", { className: toggleMountingPosition, onClick: () => {
                        switch (mountingPosition) {
                            case 1 /* Bottom */:
                                handleMountAtPane();
                                mountAtPane();
                                break;
                            case 0 /* Pane */:
                                handleMountAtBottom();
                                mountAtBottom();
                                break;
                            default:
                                console.error('no mounting position to transist from');
                        }
                    }, ref: (ref) => {
                        this.toggleMountingPositionButton = ref;
                    } },
                    React.createElement("span", { className: "icon icon-versions" })))));
    }
}
exports.default = react_redux_1.connect(mapStateToProps, mapDispatchToProps)(Dashboard);
//# sourceMappingURL=Dashboard.js.map