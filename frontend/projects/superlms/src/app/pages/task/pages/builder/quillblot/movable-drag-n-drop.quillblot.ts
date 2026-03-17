// import Quill from "quill";

// const Inline: any = Quill.import("blots/inline");
// interface MovableDragNDropBlotParams {
//   text: string;
//   participantAnswerId: string;
// }

// export class MovableDragNDropBlot extends Inline {
//   static blotName = "slms-movable-drag-n-drop";
//   static tagName = "span";
//   static className = "movable-drag-n-drop";

//   static create(params: MovableDragNDropBlotParams) {
//     const node: HTMLElement = super.create();
//     node.setAttribute("draggable", "true");
//     node.setAttribute("contenteditable", "false");
//     node.setAttribute("participant-answer-id", params.participantAnswerId);
//     node.style.minWidth = "200px";
//     node.style.width = "fit-content";

//     ////////////////////
//     //************* Use this for image purposes *************///
//     node.style.cursor = "move";
//     node.style.position = "absolute"; // Required for free dragging
//     node.style.left = "100px";
//     node.style.top = "100px";
//     node.style.zIndex = "999";

//     // Add drag logic
//     let offsetX = 0;
//     let offsetY = 0;
//     let isDragging = false;

//     node.addEventListener("mousedown", (e) => {
//       isDragging = true;
//       offsetX = e.clientX - node.offsetLeft;
//       offsetY = e.clientY - node.offsetTop;
//       document.body.style.userSelect = "none"; // Prevent text selection
//     });

//     document.addEventListener("mousemove", (e) => {
//       if (isDragging) {
//         node.style.left = `${e.clientX - offsetX}px`;
//         node.style.top = `${e.clientY - offsetY}px`;
//       }
//     });

//     document.addEventListener("mouseup", () => {
//       isDragging = false;
//       document.body.style.userSelect = "";
//     });
//     //////////////////////

//     node.style.backgroundColor = "#f5f5f5";
//     node.style.borderRadius = "4px";
//     node.style.paddingLeft = "6px";
//     node.style.paddingRight = "6px";
//     node.style.textAlign = "center";
//     node.style.fontWeight = "800";
//     node.style.color = "#555555";
//     node.style.border = "2px dashed #d9d9d9";
//     node.innerText = params.text || "";

//     // Add dragover and drop handlers
//     node.ondragover = (e): void => {
//       // console.log("ondragover", e);
//       e.preventDefault(); // Necessary to allow drop
//     };

//     node.ondrop = (e): void => {
//       e.preventDefault();
//       const transferredData = JSON.parse(e.dataTransfer?.getData("text/plain")) as MovableDragNDropBlotParams;

//       console.log("ondrop", transferredData);
//       if (transferredData) {
//         node.setAttribute("participant-answer-id", transferredData.participantAnswerId);
//         node.innerText = transferredData.text || "";
//         node.style.backgroundColor = "#d9d9d9";
//       }
//     };
//     return node;
//   }

//   static value(node: any) {
//     console.log(node.dataset);
//     return {
//       label: node.dataset.label,
//     };
//   }
// }
