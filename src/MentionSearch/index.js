import React, { Component } from 'react';

import MentionOption from './MentionOption';
import addMention from '../modifiers/addMention';
import getSearchText from '../utils/getSearchText';
import decodeOffsetKey from '../utils/decodeOffsetKey';
import { genKey, getVisibleSelectionRect } from 'draft-js';
import { List } from 'immutable';

export default class MentionSearch extends Component {

  state = {
    isOpen: false,
  };

  componentWillMount() {
    this.key = genKey();

    // TODO
    // this.props.callbacks.onChange = this.props.callbacks.onChange.set(this.key, this.onEditorStateChange);
  }

  componentDidMount() {
    // since the initial state is false we have to set the proper aria states
    // for a closed popover
    this.updateAriaCloseDropdown();

    // Note: to force a re-render of the outer component to change the aria props
    // TODO
    // this.props.store.setEditorState(this.props.store.getEditorState());
  }

  componentWillUpdate = (nextProps) => {
    if (nextProps.store.searchActive) {
      // TODO avoid double binding
      this.props.store.forceRenderOfMentionSearch = this.forceUpdate.bind(this);
      this.props.store.filteredMentions = this.getMentionsForFilter();
    } else {
      this.props.store.forceRenderOfMentionSearch = undefined;
      this.props.store.filteredMentions = undefined;
    }
  };

  componentDidUpdate = () => {
    if (this.refs.popover) {
      const visibleRect = getVisibleSelectionRect(window);
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
      this.refs.popover.style.top = `${visibleRect.top + scrollTop}px`;
      this.refs.popover.style.left = `${visibleRect.left + scrollLeft}px`;
    }

    // In case the list shrinks there should be still an option focused.
    // Note: this might run multiple times and deduct 1 until the condition is
    // not fullfilled anymore.
    // TODO
    // const size = this.props.store.filteredMentions.size;
    // if (size > 0 && this.props.store.focusedOptionIndex >= size) {
    //   this.setState({
    //     focusedOptionIndex: this.props.store.filteredMentions.size - 1,
    //   });
    // }
  };

  componentWillUnmount = () => {
    this.props.callbacks.onChange = this.props.callbacks.onChange.delete(this.key);
  };

  onEditorStateChange = (editorState) => {
    const removeList = () => {
      if (this.state.isOpen) {
        this.closeDropdown();
      }

      return editorState;
    };

    // identify the start & end positon of the search-text
    const { blockKey, decoratorKey, leafKey } = decodeOffsetKey(this.props.offsetKey);

    // the leave can be empty when it is removed due e.g. using backspace
    const leave = editorState
      .getBlockTree(blockKey)
      .getIn([decoratorKey, 'leaves', leafKey]);
    if (leave === undefined) {
      return editorState;
    }

    const { start, end } = leave;

    // get the current selection
    const selection = editorState.getSelection();

    // the list should not be visible if a range is selected or the editor has no focus
    if (!selection.isCollapsed() || !selection.getHasFocus()) return removeList();

    // only show the search component for the current block
    const sameBlock = selection.getAnchorKey() === blockKey;
    if (!sameBlock) return removeList();

    // Checks that the cursor is after the @ character but still somewhere in
    // the word (search term). Setting it to allow the cursor to be left of
    // the @ causes troubles as due selection confusion.
    const anchorOffset = selection.getAnchorOffset();
    if (anchorOffset <= start || end < anchorOffset) return removeList();

    // If none of the above triggered to close the window, it's safe to assume
    // the dropdown should be open. This is useful when a user focuses on another
    // input field and then comes back: the dropwdown will again.
    if (!this.state.isOpen) {
      this.openDropdown();
    }

    return editorState;
  };

  onMentionSelect = (mention) => {
    this.closeDropdown();
    const newEditorState = addMention(this.props.store.getEditorState(), mention);
    this.props.store.setEditorState(newEditorState);
  };

  onMentionFocus = (index) => {
    const descendant = `mention-option-${this.key}-${index}`;
    this.props.ariaProps.ariaActiveDescendantID = this.props.ariaProps.ariaActiveDescendantID.set(this.key, descendant);

    this.props.store.focusedOptionIndex = index;

    // to force a re-render of the outer component to change the aria props
    this.props.store.setEditorState(this.props.store.getEditorState());
  };

  // Get the first 5 mentions that match
  getMentionsForFilter = () => {
    const selection = this.props.store.getEditorState().getSelection();
    const { word } = getSearchText(this.props.store.getEditorState(), selection);
    const mentionValue = word.substring(1, word.length).toLowerCase();
    const mentions = this.props.mentions ? this.props.mentions : List([]);
    const filteredValues = mentions.filter((mention) => (
      !mentionValue || mention.get('name').toLowerCase().indexOf(mentionValue) > -1
    ));
    const size = filteredValues.size < 5 ? filteredValues.size : 5;
    return filteredValues.setSize(size);
  };

  updateAriaCloseDropdown = () => {
    this.props.ariaProps.ariaHasPopup = this.props.ariaProps.ariaHasPopup.delete(this.key);
    this.props.ariaProps.ariaExpanded = this.props.ariaProps.ariaExpanded.delete(this.key);
    this.props.ariaProps.ariaActiveDescendantID = this.props.ariaProps.ariaActiveDescendantID.delete(this.key);
    this.props.ariaProps.ariaOwneeID = this.props.ariaProps.ariaOwneeID.delete(this.key);
  };

  closeDropdown = () => {
    // make sure none of these callbacks are triggered
    this.props.callbacks.onDownArrow = this.props.callbacks.onDownArrow.delete(this.key);
    this.props.callbacks.onUpArrow = this.props.callbacks.onUpArrow.delete(this.key);
    this.props.callbacks.onEscape = this.props.callbacks.onEscape.delete(this.key);
    this.props.callbacks.handleReturn = this.props.callbacks.handleReturn.delete(this.key);
    this.updateAriaCloseDropdown();
    this.setState({
      isOpen: false,
    });
  };

  render() {
    if (!this.props.store.searchActive) {
      // TODO change this to null
      return null;
    }

    const { theme } = this.props;
    return (
      <div
        {...this.props}
        className={ theme.get('autocomplete') }
        contentEditable={ false }
        role="listbox"
        id={ `mentions-list-${this.key}` }
        ref="popover"
      >
        {
          this.props.store.filteredMentions.map((mention, index) => (
            <MentionOption
              key={ mention.get('name') }
              onMentionSelect={ this.onMentionSelect }
              onMentionFocus={ this.onMentionFocus }
              isFocused={ this.props.store.focusedOptionIndex === index }
              mention={ mention }
              index={ index }
              id={ `mention-option-${this.key}-${index}` }
              theme={ theme }
            />
          ))
        }
      </div>
    );
  }
}
