import React from 'react';
import { findDOMNode } from 'react-dom';
import calculatePosition from './Utils';

import styles from './index.css.js';
const POSITION_TYPES = [
    'top left',
    'top center',
    'top right',
    'right top',
    'right center',
    'right bottom',
    'bottom left',
    'bottom center',
    'bottom right',
    'left top',
    'left center',
    'left bottom',
];

function makeid() {
    var text = '';
    var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (var i = 0; i < 5; i++) text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

function clickedInsideOrChildren(element, toFind) {
    if (element == toFind) return true;
    if (element.children && element.children.length > 0) {
        let found = false;
        for (let child of element.children) {
            if (clickedInsideOrChildren(child, toFind)) found = true;
        }
        return found;
    }
    return false;
}

export default class Popup extends React.PureComponent {
    static defaultProps = {
        children: () => <span> Your Content Here !!</span>,
        trigger: null,
        onOpen: () => {},
        onClose: () => {},
        defaultOpen: false,
        open: false,
        preventClose: false,
        disabled: false,
        closeOnDocumentClick: true,
        keepOnlyOneInstanceOpen: false,
        repositionOnResize: true,
        closeOnEscape: true,
        keepOpenOnClick: false,
        on: ['click'],
        contentStyle: {},
        arrowStyle: {},
        overlayStyle: {},
        className: '',
        position: 'bottom center',
        modal: false,
        lockScroll: false,
        arrow: true,
        offsetX: 0,
        offsetY: 0,
        mouseEnterDelay: 100,
        mouseLeaveDelay: 100,
        keepTooltipInside: false,
    };
    state = {
        isOpen: this.props.open || this.props.defaultOpen,
        modal: this.props.modal ? true : !this.props.trigger,
        openedBy: null,
        // we create this modal state because the popup can't be a tooltip if the trigger prop doesn't exist
    };

    constructor(props) {
        super(props);
        this.setTriggerRef = r => (this.TriggerEl = r);
        this.setContentRef = r => (this.ContentEl = r);
        this.setArrowRef = r => (this.ArrowEl = r);
        this.setHelperRef = r => (this.HelperEl = r);
        this.timeOut = 0;
        this.listenerAdded = false;
        this.uuid = makeid();
    }

    componentDidMount() {
        const { closeOnEscape, defaultOpen, repositionOnResize, keepOnlyOneInstanceOpen } = this.props;
        if (defaultOpen) this.setPosition();
        if (closeOnEscape) {
            window.addEventListener('keyup', this.onEscape);
        }
        if (repositionOnResize) {
            window.addEventListener('resize', this.repositionOnResize);
        }

        if (keepOnlyOneInstanceOpen && typeof document !== 'undefined') {
            document.addEventListener('closeOtherPopovers', event => {
                if (event.whatToKeep === this.uuid) return;
                this.closePopup(true);
            });
        }
    }

    componentWillUnmount() {
        if (typeof document !== 'undefined') {
            this.listenerAdded && document.removeEventListener('mousedown', this.onDocumentClick);
        }
    }

    repositionOnResize = () => {
        this.setPosition();
    };
    onEscape = e => {
        if (e.key === 'Escape') this.closePopup();
    };

    componentWillReceiveProps(nextProps) {
        if (this.props.open === nextProps.open) return;
        if (nextProps.open) this.openPopup(null);
        else this.closePopup();
    }

    componentDidUpdate(prevProps) {
        if (prevProps.disabled !== this.props.disabled && this.props.disabled && this.state.isOpen) {
            this.closePopup();
        }
    }

    componentWillUnmount() {
        // kill any function to execute if the component is unmounted
        clearTimeout(this.timeOut);

        const { closeOnEscape, repositionOnResize } = this.props;
        // remove events listeners
        if (closeOnEscape) {
            window.removeEventListener('keyup', this.onEscape);
        }
        if (repositionOnResize) {
            window.removeEventListener('resize', this.repositionOnResize);
        }
    }

    lockScroll = () => {
        if (this.state.modal && this.props.lockScroll) document.getElementsByTagName('body')[0].style.overflow = 'hidden';
    };
    resetScroll = () => {
        if (this.state.modal && this.props.lockScroll) document.getElementsByTagName('body')[0].style.overflow = 'auto';
    };

    togglePopup = () => {
        const { isOpen, openedBy } = this.state;
        const { keepOpenOnClick } = this.props;
        if (isOpen && keepOpenOnClick && openedBy === 'hover') return this.setState({ openedBy: 'click' });
        if (isOpen) this.closePopup();
        else this.openPopup(true);
    };
    openPopup = byClick => {
        const { keepOnlyOneInstanceOpen, disabled, onOpen, on } = this.props;
        const { isOpen } = this.state;
        if (isOpen || disabled) return;
        if (keepOnlyOneInstanceOpen && typeof document !== 'undefined') {
            const event = new Event('closeOtherPopovers', { whatToKeep: this.uuid });
            document.dispatchEvent(event);
        }

        if (byClick === null && on.length === 1 && on[0] === 'click') byClick = 'click';

        this.setState({ isOpen: true, openedBy: byClick ? 'click' : 'hover' }, () => {
            this.setPosition();
            onOpen && onOpen();
            this.lockScroll();
        });
    };
    closePopup = force => {
        if (!this.state.isOpen || (this.props.preventClose && !force)) return; // allow for the user to prevent close
        this.props.onClose();
        this.setState({ isOpen: false, openedBy: null }, () => {
            this.resetScroll();
        });
    };
    onMouseEnter = event => {
        const { isOpen } = this.state;
        clearTimeout(this.timeOut);
        if (!isOpen) {
            const { mouseEnterDelay } = this.props;
            this.timeOut = setTimeout(() => this.openPopup(), mouseEnterDelay);
        }
    };
    onMouseLeave = event => {
        clearTimeout(this.timeOut);
        const { mouseLeaveDelay, keepOpenOnClick } = this.props;
        const { openedBy } = this.state;
        if (keepOpenOnClick && openedBy === 'click') return;
        this.timeOut = setTimeout(() => this.closePopup(), mouseLeaveDelay);
    };

    getTooltipBoundary = () => {
        const { keepTooltipInside } = this.props;
        let boundingBox = {
            top: 0,
            left: 0,
            width: window.innerWidth,
            height: window.innerHeight,
        };
        if (typeof keepTooltipInside === 'string') {
            const selector = document.querySelector(keepTooltipInside);
            if (process.env.NODE_ENV !== 'production') {
                if (selector === null)
                    throw new Error(
                        `${keepTooltipInside} selector is not exist : keepTooltipInside must be a valid html selector 'class' or 'Id'  or a boolean value`
                    );
            }
            boundingBox = selector.getBoundingClientRect();
        }
        return boundingBox;
    };

    setPosition = () => {
        const { modal, isOpen } = this.state;
        if (modal || !isOpen) return;
        const { arrow, position, offsetX, offsetY, keepTooltipInside, arrowStyle } = this.props;
        const helper = this.HelperEl.getBoundingClientRect();
        const trigger = this.TriggerEl.getBoundingClientRect();
        const content = this.ContentEl.getBoundingClientRect();
        const boundingBox = this.getTooltipBoundary();
        let positions = Array.isArray(position) ? position : [position];

        // keepTooltipInside would be activated if the  keepTooltipInside exist or the position is Array
        if (keepTooltipInside || Array.isArray(position)) positions = [...positions, ...POSITION_TYPES];

        const cords = calculatePosition(
            trigger,
            content,
            positions,
            arrow,
            {
                offsetX,
                offsetY,
            },
            boundingBox
        );
        this.ContentEl.style.top = cords.top - helper.top + 'px';
        this.ContentEl.style.left = cords.left - helper.left + 'px';
        if (arrow) {
            this.ArrowEl.style['transform'] = cords.transform;
            this.ArrowEl.style['-ms-transform'] = cords.transform;
            this.ArrowEl.style['-webkit-transform'] = cords.transform;
            this.ArrowEl.style.top = arrowStyle.top || cords.arrowTop;
            this.ArrowEl.style.left = arrowStyle.left || cords.arrowLeft;
        }
        if (
            window.getComputedStyle(this.TriggerEl, null).getPropertyValue('position') == 'static' ||
            window.getComputedStyle(this.TriggerEl, null).getPropertyValue('position') == ''
        )
            this.TriggerEl.style.position = 'relative';
    };

    addWarperAction = () => {
        const { contentStyle, className, on } = this.props;
        const { modal } = this.state;
        const popupContentStyle = modal ? styles.popupContent.modal : styles.popupContent.tooltip;

        const childrenElementProps = {
            className: `popup-content ${className}`,
            style: Object.assign({}, popupContentStyle, contentStyle),
            ref: this.setContentRef,
            onClick: e => {
                e.stopPropagation();
            },
        };
        if (!modal && on.indexOf('hover') >= 0) {
            childrenElementProps.onMouseOver = this.onMouseEnter;
            childrenElementProps.onMouseOut = this.onMouseLeave;
        }
        return childrenElementProps;
    };
    renderTrigger = () => {
        const triggerProps = { key: 'T' };
        const { on, trigger } = this.props;
        const onAsArray = Array.isArray(on) ? on : [on];

        return (
            <div
                onClick={onAsArray.includes('click') ? this.togglePopup : null}
                onMouseEnter={onAsArray.includes('hover') ? this.onMouseEnter : null}
                onMouseLeave={onAsArray.includes('hover') ? this.onMouseLeave : null}
                onFocus={onAsArray.includes('focus') ? this.onMouseEnter : null}
                key="T">
                {trigger}
            </div>
        );
    };

    renderContent = () => {
        const { arrow, arrowStyle } = this.props;
        const { modal } = this.state;
        return (
            <div {...this.addWarperAction()} key="C">
                {arrow && !modal && <div ref={this.setArrowRef} style={Object.assign({}, styles.popupArrow, arrowStyle)} />}
                {typeof this.props.children === 'function' ? this.props.children(this.closePopup, this.state.isOpen) : this.props.children}
            </div>
        );
    };

    onDocumentClick = event => {
        if (
            !clickedInsideOrChildren(findDOMNode(this.ContentEl), event.target) &&
            !clickedInsideOrChildren(findDOMNode(this.TriggerEl), event.target)
        ) {
            const { closeOnDocumentClick, overridePreventCloseOnDocumentClick, preventClose } = this.props;
            if ((preventClose && !overridePreventCloseOnDocumentClick) || !closeOnDocumentClick) return;
            this.closePopup(true);
        }
    };

    render() {
        const { overlayStyle, closeOnDocumentClick, on } = this.props;
        const { modal, openedBy, isOpen } = this.state;
        const overlay = this.state.isOpen && closeOnDocumentClick && openedBy === 'click';
        if (overlay && !this.listenerAdded) {
            this.listenerAdded = true;
            document.addEventListener('mousedown', this.onDocumentClick);
        } else if (!overlay && this.listenerAdded) {
            this.listenerAdded = false;
            document.removeEventListener('mousedown', this.onDocumentClick);
        }
        return [
            !!this.props.trigger && (
                <Ref innerRef={this.setTriggerRef} key="R">
                    {this.renderTrigger()}
                </Ref>
            ),
            this.state.isOpen && <div key="H" style={{ position: 'absolute', top: '0px', left: '0px' }} ref={this.setHelperRef} />,
            this.state.isOpen && !modal && this.renderContent(),
        ];
    }
}

if (process.env.NODE_ENV !== 'production') {
    const PropTypes = require('prop-types');
    const TRIGGER_TYPES = ['hover', 'click', 'focus'];

    Popup.propTypes = {
        arrowStyle: PropTypes.object,
        contentStyle: PropTypes.object,
        overlayStyle: PropTypes.object,
        className: PropTypes.string,
        keepOpenOnClick: PropTypes.bool,
        modal: PropTypes.bool,
        closeOnDocumentClick: PropTypes.bool,
        keepOnlyOneInstanceOpen: PropTypes.bool,
        repositionOnResize: PropTypes.bool,
        disabled: PropTypes.bool,
        lockScroll: PropTypes.bool,
        offsetX: PropTypes.number,
        offsetY: PropTypes.number,
        mouseEnterDelay: PropTypes.number,
        mouseLeaveDelay: PropTypes.number,
        onOpen: PropTypes.func,
        onClose: PropTypes.func,
        open: PropTypes.bool,
        preventClose: PropTypes.bool,
        defaultOpen: PropTypes.bool,
        trigger: PropTypes.oneOfType([PropTypes.func, PropTypes.element]), // for uncontrolled component we don't need the trigger Element
        on: PropTypes.oneOfType([PropTypes.oneOf(TRIGGER_TYPES), PropTypes.arrayOf(PropTypes.oneOf(TRIGGER_TYPES))]),
        children: PropTypes.oneOfType([PropTypes.func, PropTypes.element, PropTypes.string]).isRequired,
        position: PropTypes.oneOfType([PropTypes.oneOf(POSITION_TYPES), PropTypes.arrayOf(PropTypes.oneOf(POSITION_TYPES))]),
        keepTooltipInside: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
    };
}

class Ref extends React.PureComponent {
    componentDidMount() {
        const { innerRef } = this.props;
        if (innerRef) innerRef(findDOMNode(this));
    }

    render() {
        const { children } = this.props;
        return React.Children.only(children);
    }
}
