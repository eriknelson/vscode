/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { SingleCursorState, CursorContext, CursorState } from 'vs/editor/common/controller/cursorCommon';
import { Position } from 'vs/editor/common/core/position';
import { Range } from 'vs/editor/common/core/range';
import { Selection, SelectionDirection } from 'vs/editor/common/core/selection';
import { TrackedRangeStickiness } from 'vs/editor/common/model/model';

export class OneCursor {

	public modelState: SingleCursorState;
	public viewState: SingleCursorState;

	private _selTrackedRange: string;

	constructor(context: CursorContext) {
		this.modelState = null;
		this.viewState = null;

		this._selTrackedRange = null;

		this._setState(
			context,
			new SingleCursorState(new Range(1, 1, 1, 1), 0, new Position(1, 1), 0),
			new SingleCursorState(new Range(1, 1, 1, 1), 0, new Position(1, 1), 0)
		);
	}

	public dispose(context: CursorContext): void {
		this._selTrackedRange = context.model._setTrackedRange(this._selTrackedRange, null, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges);
	}

	public asCursorState(): CursorState {
		return new CursorState(this.modelState, this.viewState);
	}

	public readSelectionFromMarkers(context: CursorContext): Selection {
		const range = context.model._getTrackedRange(this._selTrackedRange);
		if (this.modelState.selection.getDirection() === SelectionDirection.LTR) {
			return new Selection(range.startLineNumber, range.startColumn, range.endLineNumber, range.endColumn);
		}
		return new Selection(range.endLineNumber, range.endColumn, range.startLineNumber, range.startColumn);
	}

	public ensureValidState(context: CursorContext): void {
		this._setState(context, this.modelState, this.viewState);
	}

	public setState(context: CursorContext, modelState: SingleCursorState, viewState: SingleCursorState): void {
		this._setState(context, modelState, viewState);
	}

	private _setState(context: CursorContext, modelState: SingleCursorState, viewState: SingleCursorState): void {
		if (!modelState) {
			// We only have the view state => compute the model state
			const selectionStart = context.model.validateRange(
				context.convertViewRangeToModelRange(viewState.selectionStart)
			);

			const position = context.model.validatePosition(
				context.convertViewPositionToModelPosition(viewState.position.lineNumber, viewState.position.column)
			);

			modelState = new SingleCursorState(selectionStart, viewState.selectionStartLeftoverVisibleColumns, position, viewState.leftoverVisibleColumns);
		} else {
			// Validate new model state
			const selectionStart = context.model.validateRange(modelState.selectionStart);
			const selectionStartLeftoverVisibleColumns = modelState.selectionStart.equalsRange(selectionStart) ? modelState.selectionStartLeftoverVisibleColumns : 0;

			const position = context.model.validatePosition(
				modelState.position
			);
			const leftoverVisibleColumns = modelState.position.equals(position) ? modelState.leftoverVisibleColumns : 0;

			modelState = new SingleCursorState(selectionStart, selectionStartLeftoverVisibleColumns, position, leftoverVisibleColumns);
		}

		if (!viewState) {
			// We only have the model state => compute the view state
			const viewSelectionStart1 = context.convertModelPositionToViewPosition(new Position(modelState.selectionStart.startLineNumber, modelState.selectionStart.startColumn));
			const viewSelectionStart2 = context.convertModelPositionToViewPosition(new Position(modelState.selectionStart.endLineNumber, modelState.selectionStart.endColumn));
			const viewSelectionStart = new Range(viewSelectionStart1.lineNumber, viewSelectionStart1.column, viewSelectionStart2.lineNumber, viewSelectionStart2.column);
			const viewPosition = context.convertModelPositionToViewPosition(modelState.position);
			viewState = new SingleCursorState(viewSelectionStart, modelState.selectionStartLeftoverVisibleColumns, viewPosition, modelState.leftoverVisibleColumns);
		} else {
			// Validate new view state
			const viewSelectionStart = context.validateViewRange(viewState.selectionStart, modelState.selectionStart);
			const viewPosition = context.validateViewPosition(viewState.position, modelState.position);
			viewState = new SingleCursorState(viewSelectionStart, modelState.selectionStartLeftoverVisibleColumns, viewPosition, modelState.leftoverVisibleColumns);
		}

		if (this.modelState && this.viewState && this.modelState.equals(modelState) && this.viewState.equals(viewState)) {
			// No-op, early return
			return;
		}

		this.modelState = modelState;
		this.viewState = viewState;

		this._selTrackedRange = context.model._setTrackedRange(this._selTrackedRange, this.modelState.selection, TrackedRangeStickiness.AlwaysGrowsWhenTypingAtEdges);
	}
}
