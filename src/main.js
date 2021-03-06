document.addEventListener("DOMContentLoaded", function(event) {

  var workingNote;

  var componentManager = new ComponentManager(null, () => {
    // on ready
    document.body.classList.add(componentManager.platform);
    document.body.classList.add(componentManager.environment);
  });

  var ignoreTextChange = false;
  var initialLoad = true;
  var lastValue, lastUUID, clientData;

  componentManager.streamContextItem((note) => {

    if(note.uuid !== lastUUID) {
      // Note changed, reset last values
      lastValue = null;
      initialLoad = true;
      lastUUID = note.uuid;
      clientData = note.clientData;
    }

    workingNote = note;

     // Only update UI on non-metadata updates.
    if(note.isMetadataUpdate || !window.easymde) {
      return;
    }

    if(note.content.text !== lastValue) {
      ignoreTextChange = true;
      window.easymde.value(note.content.text);
      ignoreTextChange = false;
    }

    if(initialLoad) {
      initialLoad = false;
      window.easymde.codemirror.getDoc().clearHistory();
      var mode = clientData && clientData.mode;

      // Set initial editor mode
      if(mode === 'preview') {
        if(!window.easymde.isPreviewActive()) {
          window.easymde.togglePreview();
        }
      } else if(mode === 'split') {
        if(!window.easymde.isSideBySideActive()) {
          window.easymde.toggleSideBySide();
        }
      // falback config
      } else if(window.easymde.isPreviewActive()) {
        window.easymde.togglePreview();
      }
    }
  });

  window.easymde = new EasyMDE({
    element: document.getElementById("editor"),
    spellChecker: false,
    status: false,
    shortcuts: {
      toggleSideBySide: "Cmd-Alt-P"
    },
    toolbar:[
      "heading", "bold", "italic", "strikethrough",
      "|", "quote", "code",
      "|", "unordered-list", "ordered-list",
      "|", "clean-block",
      "|", "link", "image",
      "|", "table",
      "|",
      {
        className: "fa fa-eye",
        default: true,
        name: "preview",
        noDisable: true,
        title: "Toggle Preview",
        action: function() {
          window.easymde.togglePreview();
          saveMetadata();
        }
      },
      {
        className: "fa fa-columns",
        default: true,
        name: "side-by-side",
        noDisable: true,
        noMobile: true,
        title: "Toggle Side by Side",
        action: function() {
          window.easymde.toggleSideBySide();
          saveMetadata();
        }
      }
    ]
  });

  function saveMetadata() {
    function getEditorMode() {
      var editor = window.easymde;

      if(editor) {
        if (editor.isPreviewActive()) return 'preview';
        if (editor.isSideBySideActive()) return 'split';
      }
      return 'edit';
    }

    var note = workingNote;

    componentManager.saveItemWithPresave(note, () => {
      note.clientData = { mode: getEditorMode() };
    });
  }

   // Some sort of issue on Mobile RN where this causes an exception (".className is not defined")
   try {
     window.easymde.toggleFullScreen();
   } catch (e) {}

   /*
    Can be set to Infinity to make sure the whole document is always rendered, and thus the browser's text search works on it. This will have bad effects on performance of big documents.
    Really bad performance on Safari. Unusable.
    */
  window.easymde.codemirror.setOption("viewportMargin", 100);

  window.easymde.codemirror.on("change", function() {

    function strip(html) {
      var tmp = document.implementation.createHTMLDocument("New").body;
      tmp.innerHTML = html;
      return tmp.textContent || tmp.innerText || "";
    }

    function truncateString(string, limit = 90) {
      if(string.length <= limit) {
        return string;
      } else {
        return string.substring(0, limit) + "...";
      }
    }

    if(!ignoreTextChange) {
      if(workingNote) {
        // Be sure to capture this object as a variable, as this.note may be reassigned in `streamContextItem`, so by the time
        // you modify it in the presave block, it may not be the same object anymore, so the presave values will not be applied to
        // the right object, and it will save incorrectly.
        let note = workingNote;

        componentManager.saveItemWithPresave(note, () => {
          lastValue = window.easymde.value();

          var html = window.easymde.options.previewRender(window.easymde.value());
          var strippedHtml = truncateString(strip(html));

          note.content.preview_plain = strippedHtml;
          note.content.preview_html = null;
          note.content.text = lastValue;
        });

      }
    }
  });
});
