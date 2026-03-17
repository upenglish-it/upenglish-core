/**
 * Layout Component
 *
 * @file          layout.component
 * @description   Content wrapper and renders the page for dynamic content.
 * @author        John Mark Alicante
 * @since         2025 - 05 - 01
 */

import { RouterOutlet } from "@angular/router";
import { Component, OnInit, ViewEncapsulation } from "@angular/core";
//--- Components
import { NavigationHeaderComponent } from "@superlms/shared/components/navigation-header/navigation-header.component";

@Component({
  selector: "layout",
  templateUrl: "./layout.component.html",
  styleUrls: ["./layout.component.scss"],
  encapsulation: ViewEncapsulation.None,
  imports: [
    //--- NG Modules
    RouterOutlet,
    //--- Components
    NavigationHeaderComponent,
  ],
})
export class LayoutComponent implements OnInit {
  /**
   * @name          ngOnInit
   * @description   Called when component is initialize
   * @returns       {void}
   */
  public ngOnInit(): void {}
}
