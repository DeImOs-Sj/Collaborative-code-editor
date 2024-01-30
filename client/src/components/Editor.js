import React, { useEffect, useRef, useState } from "react";
import "codemirror/mode/javascript/javascript";
import "codemirror/theme/dracula.css";
import "codemirror/addon/edit/closetag";
import "codemirror/addon/edit/closebrackets";
import "codemirror/lib/codemirror.css";
import CodeMirror from "codemirror";
import { ACTIONS } from "../Actions";

function Editor({ socketRef, roomId, username, onCodeChange }) {
  const [userCursors, setUserCursors] = useState({});

  const editorRef = useRef(null);
  const cursorMarkers = useRef({});

  useEffect(() => {
    const init = async () => {
      const editor = CodeMirror.fromTextArea(
        document.getElementById("realtimeEditor"),
        {
          mode: { name: "javascript", json: true },
          theme: "dracula",
          autoCloseTags: true,
          autoCloseBrackets: true,
          lineNumbers: true,
        }
      );


      editorRef.current = editor;

      editor.setSize(null, "100%");

      editorRef.current.on("change", (instance, changes) => {
        const { origin } = changes;

        const code = instance.getValue();
        const cursorPos = editor.getCursor();
        console.log(cursorPos)

        onCodeChange(code);

        if (origin !== "setValue") {
          socketRef.current.emit(ACTIONS.CODE_CHANGE, {
            roomId,
            code,
            username,
            cursorPos,
          });
        }
      });
    };

    init();
  }, []);

  useEffect(() => {
    if (socketRef.current) {
      socketRef.current.on(ACTIONS.CODE_CHANGE, ({ code, username, cursorPositions }) => {
        if (code !== null) {
          editorRef.current.setValue(code);

          // Clear existing markers
          for (const marker in cursorMarkers.current) {
            cursorMarkers.current[marker].clear();
          }

          // Set new cursor positions
          setUserCursors(cursorPositions);
          console.log(cursorPositions)

          // Add new markers for each user's cursor
          for (const user in cursorPositions) {
            const cursor = cursorPositions[user].cursorPos;
            if (cursor && user !== username) {
              console.log(user)
              const marker = editorRef.current.markText(
                cursor,
                { line: cursor.line, ch: cursor.ch + 1 },
                { className: `cursor-marker-${user} text-blue`, clearOnEnter: true, }
              );
              editorRef.current.style.background = "#DAF7A6";
              cursorMarkers.current[user] = marker;
            }
          }
        }
      });
    }

    return () => {
      socketRef.current.off(ACTIONS.CODE_CHANGE);
    };
  }, [socketRef.current, username]);

  return (
    <div className="relative">
      <textarea id="realtimeEditor" className="CodeMirror-cursors "></textarea>
    </div>
  );
}

export default Editor;
