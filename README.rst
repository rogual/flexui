FlexUI v0.1


Spaces and Panels

  Spaces are arranged in a tree. Split spaces have 2 or more children; leaf
  spaces have 0 or more panels.

  Inside each Space, one Panel can be active, and is displayed in the space.

  Additionally, Spaces may reserve some of their screen area to draw some
  form of UI. By default, a tab bar is drawn.

  Panels can be dragged to other Spaces, or to the dividing lines between
  spaces, which causes a new Space to open there.

  Spaces must all share the same configuration, since FlexUI will
  need to create new ones on its own.

  Things about Spaces which can be customized:
    - How to indicate the panel list and current panel
        - If using the default tabstrip view, then:
            - Tab elements can be customized
            - Tabstrip element itself can be customized
        - Otherwise, custom UI and drop targets can be defined.


API Reference follows.

Utility functions

  FlexUI.installDefaultCSS()

    Call this before using FlexUI.

Drag & Drop

  Utilities for allowing users to drag panels between Spaces.

  Functions:
    | FlexUI.makeDragSource(elem, panel)
    | FlexUI.removeDragSource(elem)

  Elements which have been made into drag sources can be dragged to spaces.
  Their associated panels will then move to the chosen space.

OriTree interface

  Tree node where:
    | Node either has n>=2 children or is a leaf
    | Node has a direction ('row' or 'column')
    | Node's direction must be different from its parent's direction
    | Root node can have either direction

  Implementations: Frame, Area

  Properties:
    | oritree.parent
    | oritree.children
    | oritree.direction

  Methods:
    | oritree.insertBeforeIndex(i[, oritree])
    | oritree.insertBeforeSelf([oritree])
    | oritree.insertAfterSelf([oritree])
    | oritree.deleteSelf()
    | oritree.replaceSelf(oritree)

Frame: OriTree

  OriTree implementation where nodes are HTML elements (frame.elem) laid
  out with CSS flexbox.

  Examples: frames-fixed, frames-resizable, frames-dynamic

  Constructors:
    | frame = FlexUI.frame([childFrames])
    | frame = FlexUI.separator()

  Properties:
    frame.elem

Area: OriTree

  Layer on top of Frames, where Areas maintain resize handles between
  themselves.

  Example: areas-dynamic

  Constructors:
    | area = FlexUI.area([childAreas])

  Properties:
    | area.frame
    | area.elem (= area.frame.elem)

Space: OriTree

  Layer on top of Areas implementing a user-configurable non-overlapping
  UI panel layout.

  Constructors:
    | space = FlexUI.space([childSpaces])

  Properties:
    | space.panels
    | space.activePanel

  Methods:
    | space.setActivePanel([panel | index | null])

