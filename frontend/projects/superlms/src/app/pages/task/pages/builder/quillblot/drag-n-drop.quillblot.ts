// // draggable-blot.ts
// import Quill from "quill";

// const BlockEmbed: any = Quill.import("blots/block/embed");

// export class DraggableBlot extends BlockEmbed {
//   static blotName = "slms-drag-n-drop";
//   static tagName = "div";
//   static className = "drag-n-drop";

//   static create(value: any) {
//     const node: HTMLElement = super.create();
//     node.setAttribute("draggable", "true");
//     node.setAttribute("contenteditable", "false");
//     node.style.width = "200px";
//     node.style.backgroundColor = "red";
//     node.innerText = value.label || "Drag Me";
//     // node.dataset.label = value.label;
//     return node;
//   }

//   static value(node: any) {
//     return {
//       label: node.dataset.label,
//     };
//   }
// }
