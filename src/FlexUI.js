var FlexUI = {};

if (this.module)
  module.exports = FlexUI;

(function() {

  // -- Utility --

  function assert(cond, error) {
    if (!cond)
      throw new Error(error);
  }

  var globalCursorElem = null;
  function setGlobalCursor(cursor) {
    if (globalCursorElem)
      document.body.removeChild(globalCursorElem);
    if (cursor) {
      var elem = document.createElement('div');
      globalCursorElem = elem;
      elem.style.position = 'absolute';
      elem.style.width = '100%';
      elem.style.height = '100%';
      elem.style.left = '0';
      elem.style.top = '0';
      elem.style.zIndex = '99999';
      elem.style.cursor = cursor;
      document.body.appendChild(elem);
    }
    else
      globalCursorElem = null;
  }

  function makeDiv() {
    return document.createElement('div');
  }

  function otherDirection(x) {
    return x == 'row' ? 'column': 'row';
  }

  function directionClass(x) {
    return x == 'row' ? 'flexui-h': 'flexui-v';
  }

  /* Add the OriTree methods to item. Item will need to override
     either insertBeforeIndex or insertAfterIndex, and implement
     the parent and children properties, and maybe other stuff. */
  function addTreeMethods(item) {
    item.insertBeforeSelf = function(newItem) {
      var i = item.parent.children.indexOf(item);
      return item.parent.insertBeforeIndex(i, newItem);
    };

    item.insertAfterSelf = function(newItem) {
      var i = item.parent.children.indexOf(item);
      return item.parent.insertBeforeIndex(i + 1, newItem);
    };

    item.getRoot = function() {
      var r = item;
      while (r.parent)
        r = r.parent;
      return r;
    };

    item.insertBeforeIndex = function(i, newItem) {
      return item.insertAfterIndex(i + 1, newItem);
    };

    item.insertAfterIndex = function(i, newItem) {
      return item.insertBeforeIndex(i + 1, newItem);
    };

    item.insertBeforeChild = function(refItem, newItem) {
      var i = item.children.indexOf(refItem);
      assert(i != -1, "child not present");
      item.insertBeforeIndex(i, newItem);
    };

    item.insertAfterChild = function(refItem, newItem) {
      var i = item.children.indexOf(refItem);
      assert(i != -1, "child not present");
      item.insertAfterIndex(i, newItem);
    };

    item.prependChild  = function(newItem) {
      return item.insertBeforeIndex(0, newItem);
    };

    item.appendChild = function(newItem) {
      var n = item.children.length;
      return item.insertBeforeIndex(n, newItem);
    };

    item.removeSelf = function() {
      if (!item.parent)
        throw new Error("Can't delete; no parent");

      var i = item.parent.children.indexOf(item);
      if (i == -1)
        throw new Error('Bad state');

      item.parent.children.splice(i, 1);

      item.parent = null;
    };

    /* Call this after removing children to ensure OriTree soft
       constraint are satisfied */
    item.normalize = function() {
      if (item.parent && item.children && item.children.length == 1) {
        var child = item.children[0];

        if (child.children && child.direction == item.parent.direction) {
          while (child.children.length) {
            item.parent.insertAfterChild(item, child.children[0]);
          }
        }
        else {
          item.parent.insertBeforeChild(item, child);
        }
        item.removeSelf();
      }
    };

    /* normalize() self and all descendants */
    item.normalizeTree = function() {
      item.normalize();
      if (item.children) item.children.forEach(function(child) {
        child.normalizeTree();
      });
    };

  }

  /*
    children>=2
    dir alt

    remove -> normalize
  */


  // -- Layer 0. Layout Tree (Frame) --

  /* Provides a tree of alternating horizontal and vertical “frames”.  */

  /* Create a new frame. Access its element with frame.elem to add it to
     your document. */
  FlexUI.frame = function(children) {
    var frame = {
      children: children,
      constructor: FlexUI.frame,
      direction: 'row',
      elem: makeDiv()
    };

    addTreeMethods(frame);

    frame.setDirection = function(dir) {
      frame.direction = dir;
      frame.elem.classList.remove(directionClass(otherDirection(dir)));
      frame.elem.classList.add(directionClass(dir));
      if (children) {
        children.forEach(function(child) {
          if (child.children)
            child.setDirection(otherDirection(frame.direction));
        });
      }
    };

    frame.replaceSelf = function(newFrame) {

      var parentElem = frame.elem.parentNode;
      if (parentElem) {
        parentElem.insertBefore(newFrame.elem, frame.elem);
        parentElem.removeChild(frame.elem);
      }

      if (frame.parent) {
        var i = frame.parent.children.indexOf(frame);
        if (i == -1)
          throw new Error('noo');

        frame.parent.children.splice(i, 1, newFrame);
      }

      newFrame.parent = frame.parent;
      frame.parent = null;

      if (newFrame.parent && newFrame.children)
        newFrame.setDirection(otherDirection(newFrame.parent.direction));
    };

    var old = frame.removeSelf;

    frame.removeSelf = function() {
      frame.parent.elem.removeChild(frame.elem);
      old();
    };

    frame.insertBeforeIndex = function(i, newFrame) {
      newFrame = newFrame || FlexUI.frame();
      var refFrame = frame.children[i];

      frame.elem.insertBefore(newFrame.elem, refFrame && refFrame.elem);
      frame.children.splice(i, 0, newFrame);
      newFrame.parent = frame;

      return newFrame;
    };

    if (children) {
      frame.setDirection('row');
      children.forEach(function(child) {
        if (child.children)
          child.setDirection(otherDirection(frame.direction));
        frame.elem.appendChild(child.elem);
        child.parent = frame;
      });
    }
    else {
      frame.elem.classList.add('flexui-leaf');
    }

    return frame;
  };

  // -- Dragging handles to resize frames --

  function setupDragging(sep) {

    sep.addEventListener('mousedown', function(downEvent) {
      downEvent.preventDefault();

      var parent = sep.parentElement;
      var prev = sep.previousElementSibling;
      var next = sep.nextElementSibling;
      var dimension = parent.classList.contains('flexui-h') ? 0 : 1;
      var cursor = ['ew-resize', 'ns-resize'][dimension];

      function size(elem) {
        var rect = elem.getBoundingClientRect();
        return [rect.width, rect.height][dimension];
      }

      function mousePos(event) {
        return [event.clientX, event.clientY][dimension];
      }

      var sizes = [];
      for (var elem = parent.firstElementChild; elem; elem = elem.nextElementSibling) {
        sizes.push(size(elem));
      }

      var i = 0;
      for (elem = parent.firstElementChild; elem; elem = elem.nextElementSibling) {
        if (window.getComputedStyle(elem).flexGrow != "0")
          elem.style.flexBasis = sizes[i] + 'px';
        i++;
      }

      var downPos = mousePos(downEvent);

      var prevSize = size(prev);
      var nextSize = size(next);
      var sepSize = size(sep);
      var totalSize = prevSize + sepSize + nextSize;

      setGlobalCursor(cursor);

      function move(moveEvent) {
        moveEvent.preventDefault();
        var movePos = mousePos(moveEvent);

        var newPrevSize = prevSize + (movePos - downPos);
        var newNextSize = totalSize - newPrevSize - sepSize;

        prev.style.flexBasis = newPrevSize + 'px';
        next.style.flexBasis = newNextSize + 'px';
      }

      function up() {
        window.removeEventListener('mousemove', move);
        window.removeEventListener('mouseup', up);
        setGlobalCursor(null);
      }

      window.addEventListener('mousemove', move);
      window.addEventListener('mouseup', up);
    });
  }

  /* Adds a <style> element to the document's <head> with some default
     CSS for FlexUI. Options are:
       hit: How far each separator's hit area should extend beyond its border
            on all four sides, in pixels.
       thickness: Thickness of separators in pixels.
  */
  FlexUI.installDefaultCSS = function(options) {

    options = options || {};

    var elem = document.createElement('style');
    elem.textContent = (
      '.flexui-separator { background: black; flex-basis: $(thickness)px }\n' +
      '.flexui-separator::after { z-index: 9999; content: ""; position: absolute; left: -$(hit)px; top: -$(hit)px; right: -$(hit)px; bottom: -$(hit)px; }\n' +
      '.flexui-h { display: flex; flex-direction: row; flex-grow: 1 }\n' +
      '.flexui-v { display: flex; flex-direction: column; flex-grow: 1 }\n' +
      '.flexui-leaf { flex-grow: 1 }\n' +
      '.flexui-h > .flexui-separator { cursor: ew-resize; }\n' +
      '.flexui-v > .flexui-separator { cursor: ns-resize; }\n' +
      ''
    ).replace(/\$\(hit\)/g, options.hit || 2)
     .replace(/\$\(thickness\)/g, options.thickness || 1);

    document.head.appendChild(elem);
  };

  /* Creates a separator frame. This frame has a fixed
     (normally small) size. Its element is draggable and allows the user
     to resize the frames on either side of it. */
  FlexUI.separator = function() {
    var frame = FlexUI.frame();
    var elem = frame.elem;
    elem.classList.add('flexui-separator');
    elem.style.flexGrow = '0';
    elem.style.flexShrink = '0';
    elem.style.position = 'relative';
    setupDragging(elem);

    return frame;
  };


  // -- Layer 1. Area --

  /* Areas are a layer on top of Frames. Areas ensure that they are always
     interleaved with separators. */
  FlexUI.area = function(children) {
    var area = {
      children: children,
      constructor: FlexUI.area
    };

    addTreeMethods(area);

    if (children) {
      var frameChildren = [];
      children.forEach(function(child, i) {
        if (i != 0)
          frameChildren.push(FlexUI.separator());
        frameChildren.push(child.frame);
        child.parent = area;
      });
      area.frame = FlexUI.frame(frameChildren);
    }
    else
      area.frame = FlexUI.frame();

    area.elem = area.frame.elem;

    area.replaceSelf = function(newArea) {
      area.frame.replaceSelf(newArea.frame);
      if (area.parent) {
        var i = area.parent.children.indexOf(area);
        area.parent.children.splice(i, 1, newArea);
      }
      newArea.parent = area.parent;
      area.parent = null;
    };

    var old = area.removeSelf;
    area.removeSelf = function() {
      var i = area.frame.parent.children.indexOf(area.frame);
      if (area.frame.parent.children.length == 1)
        area.frame.removeSelf();
      else if (i != 0) {
        area.frame.parent.children[i - 1].removeSelf();
        area.frame.removeSelf();
      }
      else {
        area.frame.parent.children[i + 1].removeSelf();
        area.frame.removeSelf();
      }
      old();
    };

    area.setDirection = area.frame.setDirection;

    area.insertBeforeIndex = function(i, newArea) {
      newArea = newArea || FlexUI.area();
      var refArea = area.children[i];

      area.children.splice(i, 0, newArea);

      var frameIndex = 2 * i;

      if (area.children.length != 1) {
        area.frame.insertBeforeIndex(frameIndex, FlexUI.separator());
      }
      area.frame.insertBeforeIndex(frameIndex, newArea.frame);

      newArea.parent = area;

      return newArea;
    };

    return area;
  };


  // -- Layer 2. Spaces --

  function lowest(xs, fn) {
    var bestV, bestX;
    xs.forEach(function(x, i) {
      var v = fn(x);
      if (i == 0 || v < bestV ) {
        bestV = v;
        bestX = x;
      }
    });
    return bestX;
  }

  function makeButton(name, action) {
    var el = document.createElement('button');
    el.textContent = name;
    el.onclick = action;
    return el;
  }

  /* The space layer can be totally customized by setting the space delegate.
     This is the default delegate, which implements a tab bar in each
     space. */
  FlexUI.tabSpaceDelegate = {
    init: function(space) {
      space.dd = {};

      if (!space.children) {
        var tabBar = space.dd.tabBar = makeDiv();
        tabBar.className = 'flexui-tab-bar';
        space.elem.appendChild(tabBar);

        var coTabBar = space.dd.coTabBar = makeDiv();
        space.elem.appendChild(coTabBar);
      }

      var tabs = space.dd.tabs = [];
    },
    panelDraggedOver: function(event) {
    },
    panelDraggingOver: function(event) {
      var dropIndicator = FlexUI.tabSpaceDelegate.dropIndicator;
      var tabBar = event.space.dd.tabBar;

      var rect = event.space.elem.getBoundingClientRect();
      var x = event.moveEvent.clientX;
      var y = event.moveEvent.clientY;
      var pos = [x, y];

      var edgeDistances = [
        y - rect.top,
        rect.right - x,
        rect.bottom - y,
        x - rect.left
      ];

      var edge = lowest([0, 1, 2, 3], function(i) {
        var v = edgeDistances[i];
        return (v > 0) ? v : Infinity;
      });

      var threshold = event.space.children ? 25 : 50;

      var distance = edgeDistances[edge];
      if (distance < threshold) {
        var edgeName = ['top', 'right', 'bottom', 'left'][edge];

        event.space.dd.drop = {edge: edge};

        event.space.elem.appendChild(dropIndicator);
        dropIndicator.className = '';
        dropIndicator.classList.add('flexui-drop-indicator');
        dropIndicator.classList.add('flexui-drop-indicator-edge');
        dropIndicator.classList.add('flexui-drop-indicator-' + edgeName);
        event.stopPropagation();
      }
      else if (tabBar) {

        event.space.dd.drop = {tab: event.space.dd.tabs.length};

        tabBar.appendChild(dropIndicator);
        dropIndicator.className = '';
        dropIndicator.classList.add('flexui-drop-indicator');
        dropIndicator.classList.add('flexui-drop-indicator-newtab');
        event.stopPropagation();
      }
      else {
        event.space.dd.drop = null;
        if (dropIndicator.parentNode)
          dropIndicator.parentNode.removeChild(dropIndicator);
      }
    },
    panelDraggedOut: function(event) {
      event.space.dd.drop = null;
      var dropIndicator = FlexUI.tabSpaceDelegate.dropIndicator;
      if (dropIndicator.parentNode)
        dropIndicator.parentNode.removeChild(dropIndicator);
    },
    panelDropped: function(event) {
      var dropIndicator = FlexUI.tabSpaceDelegate.dropIndicator;
      if (dropIndicator.parentNode)
        dropIndicator.parentNode.removeChild(dropIndicator);

      var space = event.space;
      var drop = space.dd.drop;
      if (drop && drop.edge !== undefined) {

        var dropAxis = ['column', 'row', 'column', 'row'][drop.edge];

        var newSpace = FlexUI.leafSpace([]);
        var newSplit, copySpace;

        if (!space.parent) {
          if (space.children) {
            if (dropAxis == space.direction) {
              if (drop.edge == 0 || drop.edge == 3)
                space.prependChild(newSpace);
              else
                space.appendChild(newSpace);
            }
            else {
              copySpace = FlexUI.splitSpace([]);

              if (drop.edge == 0 || drop.edge == 3)
                newSplit = FlexUI.splitSpace([newSpace, copySpace]);
              else
                newSplit = FlexUI.splitSpace([copySpace, newSpace]);

              while (space.children.length)
                copySpace.appendChild(space.children[0]);

              space.replaceSelf(newSplit);
              newSplit.setDirection(otherDirection(space.direction));
            }
          }
          else {
          }
        }
        else {
          if (dropAxis == space.parent.direction) {
            if (drop.edge == 0 || drop.edge == 3)
              space.parent.insertBeforeChild(space, newSpace);
            else
              space.parent.insertAfterChild(space, newSpace);
          }
          else {
            if (space.children && dropAxis == space.direction) {
              if (drop.edge == 0 || drop.edge == 3)
                space.parent.prependChild(space, newSpace);
              else
                space.parent.appendChild(space, newSpace);
            }
            else {

              var active = space.activePanel;
              console.log('active is', active && active.elem);
              copySpace = FlexUI.leafSpace([]);
              while (space.panels.length) {
                var panel = space.panels[0];
                copySpace.addPanel(panel);
              }

              if (drop.edge == 0 || drop.edge == 3)
                newSplit = FlexUI.splitSpace([newSpace, copySpace]);
              else
                newSplit = FlexUI.splitSpace([copySpace, newSpace]);
              space.replaceSelf(newSplit);

              copySpace.setActivePanel(active);
            }

          }

        }
        newSpace.addPanel(event.panel);
        newSpace.getRoot().normalizeTree();
      }
      else if (drop && !space.children) {
        event.space.addPanel(event.panel);
        event.space.setActivePanel(event.panel);
        event.space.getRoot().normalizeTree();
      }
    },
    makeTab: function(space, panel) {
      var tab = makeDiv();
      tab.className = 'flexui-tab';
      tab.textContent = panel.name;
      tab.onclick = function() {
        space.setActivePanel(panel);
      };
      FlexUI.makeDragSource(tab, panel);

      if (panel == space.activePanel) {
        tab.classList.add('flexui-active');
      }
      else {
        tab.classList.remove('flexui-active');
      }

      if (panel.closable) {
        var close = makeButton('x', function(e) {
          e.stopPropagation();
          space.removePanel(panel);
          space.normalize();
        });
        tab.appendChild(close);
      }

      return tab;
    },
    buildTabBar: function(space) {
      var tabs = space.dd.tabs;
      var tabBar = space.dd.tabBar;
      tabs.splice(0, tabs.length);
      space.panels.forEach(function(panel) {

        var tab = spaceDelegate.makeTab(space, panel);

        tabBar.appendChild(tab);
        tabs.push(tab);
      });
    },
    setPanels: function(space, panels) {
      var tabBar = space.dd.tabBar;
      tabBar.textContent = '';
      spaceDelegate.buildTabBar(space);
    },
    setActivePanel: function(space, panel, index) {
      var tabs = space.dd.tabs;
      var coTabBar = space.dd.coTabBar;

      coTabBar.textContent = '';
      if (!panel)
        return;
      coTabBar.appendChild(panel.elem);
      tabs.forEach(function(tab, i) {
        if (i == index)
          tab.classList.add('flexui-active');
        else
          tab.classList.remove('flexui-active');
      });
    }
  };

  (function() {
    var dropIndicator = FlexUI.tabSpaceDelegate.dropIndicator = makeDiv();
    dropIndicator.textContent = ' ';
    dropIndicator.className = 'flexui-drop-indicator';
  })();

  var spaceDelegate = FlexUI.tabSpaceDelegate;

  /* Call this to set your own space delegate. You might want to inherit
     from FlexUI.tabSpaceDelegate, but you don't have to. */
  FlexUI.setSpaceDelegate = function(delegate) {
    spaceDelegate = delegate;
  };

  function makeSpace(space) {
    addTreeMethods(space);

    space.replaceSelf = function(newSpace) {
      space.area.replaceSelf(newSpace.area);
      if (space.parent) {
        var i = space.parent.children.indexOf(space);
        assert (i != -1);
        space.parent.children.splice(i, 1, newSpace);
      }
      newSpace.parent = space.parent;
      space.parent = null;
      return newSpace;
    };

    var old = space.removeSelf;
    space.removeSelf = function() {
      space.area.removeSelf();
      old();
    };

    spaceDelegate.init(space);
    return space;
  }

  /* Create a split (non-leaf) node in the space tree */
  FlexUI.splitSpace = function(children) {

    //assert(children.length >= 2, "splitSpace needs at least 2 children");

    var space = makeSpace({
      children: children,
      constructor: FlexUI.splitSpace,
      isLeaf: false
    });

    spaceDelegate.init(space);

    children.forEach(function(child) {
      child.parent = space;
    });

    space.area = FlexUI.area(children.map(function(child) {
      return child.area;
    }));

    space.setDirection = function(dir) {
      space.area.frame.setDirection(dir);
    };

    Object.defineProperty(space, 'direction', {get: function() {
      return space.area.frame.direction;
    }});

    space.elem = space.area.elem;
    space.elem.classList.add('flexui-space');

    space.insertBeforeIndex = function(i, newSpace) {
      if (newSpace.parent)
        newSpace.removeSelf();

      newSpace = newSpace || FlexUI.leafSpace([]);
      space.children.splice(i, 0, newSpace);
      space.area.insertBeforeIndex(i, newSpace.area);
      newSpace.parent = space;
    };

    return space;
  };

  /* Create a leaf node in the space tree. */
  FlexUI.leafSpace = function(panels) {

    var area = FlexUI.area();

    var space = makeSpace({
      panels: panels,
      constructor: FlexUI.leafSpace,
      isLeaf: true,
      area: area,
      elem: area.elem
    });

    /* Normalize a leaf space */
    var old = space.normalize;
    space.normalize = function() {
      if (space.panels.length == 0) {
        space.activePanel = null;
        var parent = space.parent;
        space.removeSelf();
        parent.normalize();
      }
      else if (space.activePanel && space.activePanel.space != space) {
        //space.setActivePanel(space.panels[0] || null);
      }
    };

    space.elem.classList.add('flexui-space');

    spaceDelegate.setPanels(space, panels);

    space.setActivePanel = function(panel) {

      if (panel === null) {
        space.panelElem = null;
        spaceDelegate.setActivePanel(space, null);
        return;
      }

      if (typeof(panel) == 'number')
        panel = space.panels[panel];

      space.activePanel = panel;
      space.panelElem = space.activePanel.elem;

      var index = space.panels.indexOf(panel);
      spaceDelegate.setActivePanel(space, panel, index);
    };

    if (panels.length)
      space.setActivePanel(0);
    else
      space.setActivePanel(null);

    panels.forEach(function(panel) {
      panel.space = space;
    });

    space.addPanel = space.appendPanel = function(newPanel) {

      if (newPanel.space)
        newPanel.space.removePanel(newPanel);

      space.panels.push(newPanel);
      spaceDelegate.setPanels(space, panels);
      if (panels.length == 1)
        space.setActivePanel(0);
      newPanel.space = space;
      return newPanel;
    };

    space.removePanel = function(panel) {

      var activeIndex = null;
      if (space.activePanel)
        activeIndex = space.panels.indexOf(space.activePanel);

      var i = space.panels.indexOf(panel);
      assert(i != -1, "panel is not in that space");
      space.panels.splice(i, 1);
      spaceDelegate.setPanels(space, panels);
      if (panel == space.activePanel);
        space.setActivePanel(null);
      panel.space = null;

      if (activeIndex !== null) {
        var activePanel = space.panels[activeIndex] || space.panels[0];
        if (activePanel)
          space.setActivePanel(activePanel);
      }
    };

    return space;
  };

  // -- Dragging panels between spaces --

  function pointInRect(x, y, rect) {
    return rect.left <= x && x < rect.right &&
           rect.top <= y && y < rect.bottom;
  }

  function spaceAt(rootSpace, x, y) {
    if (rootSpace.children) for (var i in rootSpace.children) {
      var child = rootSpace.children[i];
      var childResult = spaceAt(child, x, y);
      if (childResult)
        return childResult;
    }
    else {
      var rect = rootSpace.elem.getBoundingClientRect();
      if (pointInRect(x, y, rect))
        return rootSpace;
    }
  }

  function dragMouseDown(panel, downEvent) {
    downEvent.preventDefault();

    var fromSpace = panel.space;
    var rootSpace = fromSpace.getRoot();
    var overSpace = null;
    var targetSpace = null;

    function move(moveEvent) {
      moveEvent.preventDefault();

      var x = moveEvent.clientX;
      var y = moveEvent.clientY;

      var newOverSpace = spaceAt(rootSpace, x, y);

      if (newOverSpace != overSpace) {

        if (overSpace) {
          overSpace.elem.classList.remove('flexui-drag-over');
          spaceDelegate.panelDraggedOut({
            space: overSpace,
            panel: panel,
            moveEvent: moveEvent
          });
        }

        if (newOverSpace) {
          newOverSpace.elem.classList.add('flexui-drag-over');
          spaceDelegate.panelDraggedOver({
            space: newOverSpace,
            panel: panel,
            moveEvent: moveEvent
          });
        }

        overSpace = newOverSpace;
      }

      if (overSpace) {
        var chain = [];
        var space = overSpace;
        while (space) {
          chain.unshift(space);
          space = space.parent;
        }

        var accepted = false;
        var stopPropagation = function() { accepted = true; };

        for (var i in chain) {
          targetSpace = space = chain[i];

          spaceDelegate.panelDraggingOver({
            space: space,
            panel: panel,
            moveEvent: moveEvent,
            stopPropagation: stopPropagation
          });

          if (accepted)
            break;
        }
      }
      else
        targetSpace = null;

      downEvent.target.classList.add('flexui-drag-source');
    }

    function up(upEvent) {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);

      downEvent.target.classList.remove('flexui-drag-source');

      if (targetSpace) {
        spaceDelegate.panelDropped({
          space: targetSpace,
          panel: panel,
          upEvent: upEvent
        });
        overSpace.elem.classList.remove('flexui-drag-over');
      }
    }

    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }

  FlexUI.makeDragSource = function(elem, panel) {
    elem.flexUIDrag = dragMouseDown.bind(null, panel);
    elem.addEventListener('mousedown', elem.flexUIDrag);
  };

  FlexUI.removeDragSource = function(elem) {
    elem.removeEventListener('mousedown', elem.flexUIDrag);
  };

})();
