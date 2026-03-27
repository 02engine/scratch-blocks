/**
 * @license
 * Visual Blocks Editor
 *
 * Copyright 2017 Google Inc.
 * https://developers.google.com/blockly/
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Methods for dragging a workspace visually.
 * @author fenichel@google.com (Rachel Fenichel)
 */
'use strict';

goog.provide('Blockly.WorkspaceDragger');

goog.require('goog.math.Coordinate');
goog.require('goog.asserts');


/**
 * Class for a workspace dragger.  It moves the workspace around when it is
 * being dragged by a mouse or touch.
 * Note that the workspace itself manages whether or not it has a drag surface
 * and how to do translations based on that.  This simply passes the right
 * commands based on events.
 * @param {!Blockly.WorkspaceSvg} workspace The workspace to drag.
 * @constructor
 */
Blockly.WorkspaceDragger = function(workspace) {
  /**
   * @type {!Blockly.WorkspaceSvg}
   * @private
   */
  this.workspace_ = workspace;

  /**
   * The workspace's metrics object at the beginning of the drag.  Contains size
   * and position metrics of a workspace.
   * Coordinate system: pixel coordinates.
   * @type {!Object}
   * @private
   */
  this.startDragMetrics_ = workspace.getMetrics();

  /**
   * The scroll position of the workspace at the beginning of the drag.
   * Coordinate system: pixel coordinates.
   * @type {!goog.math.Coordinate}
   * @private
   */
  this.startScrollXY_ = new goog.math.Coordinate(
      workspace.scrollX, workspace.scrollY);

  /**
   * Pending drag update scheduled for the next animation frame.
   * @type {?number}
   * @private
   */
  this.pendingDragFrame_ = null;

  /**
   * Latest requested scrollbar positions during a drag.
   * @type {?{x: number, y: number}}
   * @private
   */
  this.pendingScrollUpdate_ = null;

  this.flushDrag_ = this.flushDrag_.bind(this);
};

/**
 * Sever all links from this object.
 * @package
 */
Blockly.WorkspaceDragger.prototype.dispose = function() {
  if (this.pendingDragFrame_ !== null) {
    cancelAnimationFrame(this.pendingDragFrame_);
    this.pendingDragFrame_ = null;
  }
  this.workspace_ = null;
  this.pendingScrollUpdate_ = null;
};

/**
 * Start dragging the workspace.
 * @package
 */
Blockly.WorkspaceDragger.prototype.startDrag = function() {
  if (Blockly.selected) {
    Blockly.selected.unselect();
  }
  this.workspace_.setupDragSurface();
};

/**
 * Finish dragging the workspace and put everything back where it belongs.
 * @param {!goog.math.Coordinate} currentDragDeltaXY How far the pointer has
 *     moved from the position at the start of the drag, in pixel coordinates.
 * @package
 */
Blockly.WorkspaceDragger.prototype.endDrag = function(currentDragDeltaXY) {
  // Make sure everything is up to date.
  this.drag(currentDragDeltaXY);
  this.flushDrag_();
  this.workspace_.resetDragSurface();
};

/**
 * Move the workspace based on the most recent mouse movements.
 * @param {!goog.math.Coordinate} currentDragDeltaXY How far the pointer has
 *     moved from the position at the start of the drag, in pixel coordinates.
 * @package
 */
Blockly.WorkspaceDragger.prototype.drag = function(currentDragDeltaXY) {
  var metrics = this.startDragMetrics_;
  var newXY = goog.math.Coordinate.sum(this.startScrollXY_, currentDragDeltaXY);

  // Bound the new XY based on workspace bounds.
  var x = Math.min(newXY.x, -metrics.contentLeft);
  var y = Math.min(newXY.y, -metrics.contentTop);
  x = Math.max(x, metrics.viewWidth - metrics.contentLeft -
               metrics.contentWidth);
  y = Math.max(y, metrics.viewHeight - metrics.contentTop -
               metrics.contentHeight);

  x = -x - metrics.contentLeft;
  y = -y - metrics.contentTop;

  this.updateScroll_(x, y);
};

/**
 * Move the scrollbars to drag the workspace.
 * x and y are in pixels.
 * @param {number} x The new x position to move the scrollbar to.
 * @param {number} y The new y position to move the scrollbar to.
 * @private
 */
Blockly.WorkspaceDragger.prototype.updateScroll_ = function(x, y) {
  this.pendingScrollUpdate_ = {x: x, y: y};
  if (this.pendingDragFrame_ !== null) {
    return;
  }
  this.pendingDragFrame_ = requestAnimationFrame(this.flushDrag_);
};

/**
 * Apply the latest pending drag update using cached metrics from drag start.
 * This avoids recalculating full workspace metrics on every mousemove.
 * @private
 */
Blockly.WorkspaceDragger.prototype.flushDrag_ = function() {
  if (!this.workspace_ || !this.pendingScrollUpdate_) {
    this.pendingDragFrame_ = null;
    return;
  }

  var update = this.pendingScrollUpdate_;
  this.pendingScrollUpdate_ = null;
  this.pendingDragFrame_ = null;

  var metrics = this.startDragMetrics_;
  var workspace = this.workspace_;

  workspace.scrollX = -update.x - metrics.contentLeft;
  workspace.scrollY = -update.y - metrics.contentTop;

  var translatedX = workspace.scrollX + metrics.absoluteLeft;
  var translatedY = workspace.scrollY + metrics.absoluteTop;
  workspace.translate(translatedX, translatedY);
  if (workspace.grid_) {
    workspace.grid_.moveTo(translatedX, translatedY);
  }

  if (workspace.scrollbar) {
    var hHandlePosition = update.x * workspace.scrollbar.hScroll.ratio_;
    var vHandlePosition = update.y * workspace.scrollbar.vScroll.ratio_;
    workspace.scrollbar.hScroll.setHandlePosition(hHandlePosition);
    workspace.scrollbar.vScroll.setHandlePosition(vHandlePosition);
  }
};
