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
  const cursorMarkers = useRef({}); // Add this line to define cursorMarkers

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
        console.log(username);

        const code = instance.getValue();
        const cursorPos = editor.getCursor();

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
      socketRef.current.on(ACTIONS.CODE_CHANGE, ({ code, username, cursorPos }) => {
        if (code !== null) {
          editorRef.current.setValue(code);
          console.log(cursorPos)

          // Use a callback for setUserCursors to ensure you're working with the latest state
          setUserCursors((prevCursors) => ({
            ...prevCursors,
            [username]: cursorPos,
          }));

          // Clear existing markers
          Object.values(cursorMarkers.current).forEach((marker) => {
            marker.clear();
          });
          console.log(cursorMarkers.current)
          // Update markers based on the latest cursor positions
          Object.entries(userCursors).forEach(([username, pos]) => {
            if (pos && pos.line !== undefined && pos.ch !== undefined) {
              const cursorClassName = `cursor-marker-${username}`;
              console.log(username)

              // Add Tailwind CSS classes for styling
              cursorMarkers.current[username] = editorRef.current.markText(pos, pos, {
                className: `absolute ${cursorClassName} bg-blue-500 px-1`,
                handleMouseEvents: true,
              });

              // Set position using Tailwind CSS
              const cursorElement = document.querySelector(`.${cursorClassName}`);
              if (cursorElement) {
                cursorElement.style.top = `${pos.top}px`;
                cursorElement.style.left = `${pos.left}px`;
                cursorElement.style.backgroundColor = "black";
              }
            }
          });
        }
      });
    }

    return () => {
      socketRef.current.off(ACTIONS.CODE_CHANGE);

      // Clear markers in the cleanup phase
      Object.values(cursorMarkers.current).forEach((marker) => {
        marker.clear();
      });
    };
  }, [socketRef.current, userCursors]);

  return (
    <div className="relative">
      <textarea id="realtimeEditor" className=""></textarea>
    </div>
  );
}

export default Editor;