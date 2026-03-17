import { TinymceOptions } from "ngx-tinymce";

export const RTinyMCEOptions: TinymceOptions = {
  baseURL: "/assets/tinymce/",
  fileName: "tinymce.min.js",
  config: {
    setMode: "design",
    plugins: "preview link media lists emoticons fullscreen table",
    toolbar: "fullscreen | preview | bold italic underline | table align bullist numlist | link media emoticons | blocks",
    menubar: false,
    branding: false,
    resize: false,
    statusbar: false,
    elementpath: false,
    placeholder: "Type here...",
    fontsize_formats: "8pt 10pt 12pt 14pt 16pt 18pt 24pt 36pt 48pt",
    // skin: 'snow',
    // content_css: 'writer',
    content_style: "body { font-size:12px; }",
    preview_style: "body { font-size:12px; }",
    toolbar_location: "bottom",
    // toolbar_sticky: true, // causing a conflict for multiple usage
    strict_loading_mode: true,
    setup: (editor: any) => {
      editor.on("input", (event: any) => {
        // console.log("event", event, event.data); // TODO: Mention
      });
      // editor.on("body", (event: any) => {
      // console.log("body editor", editor.mode.isReadOnly());

      editor.on("init", () => {
        // console.log("zx", (editor.getDoc() as HTMLIFrameElement).querySelector("a"));
        editor.getBody().addEventListener("click", function (e: any) {
          // for (let i = 0; i < document.getElementsByClassName("mce-shim").length; i++) {
          //   document.getElementsByClassName("mce-shim")[i].remove();
          // }

          /* alternative fix */
          /* remove shim for unable to play embedded youtube */
          if (e.target.className === "mce-shim") {
            e.target.remove();
          }
          // if (e.target.tagName === "IFRAME") {
          //   e.target.setAttribute("allow", "autoplay; encrypted-media");
          // }
        });
        //   Array.from(editor.getDoc().querySelectorAll("a")).map((el) => {
        //     console.log("aaa", el);
        //     // el.addEventListener('click', () => {
        //     //     const href = el.getAttribute('href';
        //     //     const target = el.getAttribute('target');
        //     //     openLink(href, target);
        //     // });
        //   });
        // });
      });

      // editor.getBody().addEventListener('click', function (e) {
      //     if (e.target.tagName === 'IFRAME') {
      //         e.target.setAttribute('allow', 'autoplay; encrypted-media');
      //     }
      // });
    },
  },
};

export const ParticipantRTinyMCEConfig = {
  setMode: "design",
  plugins: "preview fullscreen",
  toolbar: "fullscreen | preview | bold italic underline align",
  menubar: false,
  branding: false,
  resize: false,
  statusbar: false,
  elementpath: false,
  placeholder: "Type here...",
  fontsize_formats: "8pt 10pt 12pt 14pt 16pt 18pt 24pt 36pt 48pt",
  // skin: 'snow',
  // content_css: 'writer',
  content_style: "body { font-size:12px; }",
  preview_style: "body { font-size:12px; }",
  toolbar_location: "bottom",
  // toolbar_sticky: true, // causing a conflict for multiple usage
  strict_loading_mode: true,
};

export const ReviewerRTinyMCEConfig = {
  setMode: "design",
  plugins: "preview fullscreen textcolor",
  toolbar: "fullscreen | preview | bold italic underline align | forecolor backcolor",
  menubar: false,
  branding: false,
  resize: false,
  statusbar: false,
  elementpath: false,
  placeholder: "Type here...",
  fontsize_formats: "8pt 10pt 12pt 14pt 16pt 18pt 24pt 36pt 48pt",
  content_style: "body { font-size:12px; }",
  preview_style: "body { font-size:12px; }",
  toolbar_location: "bottom",
  strict_loading_mode: true,
};
