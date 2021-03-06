import * as React from 'react';
import * as classNames from 'classnames';

type Props = React.HTMLProps<HTMLElement> & {
    version: string;
    location: string;
    protocol: 'Vanilla' | 'LSP';
    selected: boolean;
    connected: boolean;
    erred: boolean;
    // callbacks
    onRemove: (e: any) => void;
    onSelect: () => void;
    onSelectAndLoad: () => void;
};

class ConnectionItem extends React.Component<Props, {}> {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <li
                className={classNames({
                    selected: this.props.selected,
                    connected: this.props.connected,
                    erred: this.props.erred,
                }, 'connection-item')}
                onClick={this.props.onSelect}
                onDoubleClick={this.props.onSelectAndLoad}
            >
                <header className="compact">
                    <h3>
                        <div className='icon icon-tag'></div>
                        <div>{this.props.version}</div>
                    </h3>
                    <div className="connection-dashboard">
                        {this.props.connected && !this.props.erred && <span className="connection-status">CONNECTED</span>}
                        {this.props.selected && !this.props.connected && !this.props.erred && <span className="connection-status">APPOINTED</span>}
                        {this.props.erred && <span className="connection-status">ERRED</span>}
                        <span
                            className="icon icon-x"
                            onClick={this.props.onRemove}
                        ></span>
                    </div>
                </header>
                <ul className='list-group'>
                    <li className='list-item'>
                        <div className='icon icon-location'></div>
                        <div>Location: {this.props.location}</div>
                    </li>
                    <li className='list-item'>
                        <div className='icon icon-comment-discussion'></div>
                        <div>Protocol: {this.props.protocol}</div>
                    </li>
                </ul>
            </li>
        )
    }

    // <div className={connectedClassNames}>
    // <button className="btn btn-warning icon icon-stop inline-block-tight">disonnect</button>
    // </div>
    // <div className={disconnectedClassNames}>
    // <button className="btn icon icon-trashcan inline-block-tight connection-delete">remove</button>
    // <button className="btn btn-primary icon icon-plug inline-block-tight">connect</button>
    // </div>

}

export default ConnectionItem;
