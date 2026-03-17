/* eslint-disable cypress/unsafe-to-chain-command */
/// <reference types="cypress" />
import { each, recurse } from "cypress-recurse";
import "cypress-real-events";

// let totalOfClass = 129;
// let totalOfMonths = 12;
// let totalOfYears = 3;

const startClass = 1; // #28 IC010
let totalOfClass = 129;

let totalOfMonths = 12;

const startYear = 1;
let totalOfYears = 4;

describe("Go to Login Page", () => {
  Cypress.config("viewportWidth", 1680);

  beforeEach(() => {
    cy.visit("https://portal.upenglishvietnam.com/login");
  });

  it("should display the login form", () => {
    cy.get('input[name="Input.Email"]').should("be.visible");
    cy.get('input[name="Input.Password"]').should("be.visible");
    cy.get('button[type="submit"]').should("be.visible");
  });

  it("should login successfully with valid credentials", async () => {
    cy.get('input[name="Input.Email"]').type("huynhquan.nguyen@gmail.com", { delay: 50 });
    cy.get('input[name="Input.Password"]').type("1>vSr:$308}r", { delay: 50, log: false }); // hide password in logs
    cy.get(".login100-form-btn").click();

    // Wait for redirect
    cy.url().should("include", "/Home/Index");

    cy.get(":nth-child(7) > a").should("be.visible").click({ multiple: true });

    cy.wait(3000 as number);

    cy.get("#slide-out > li > ul > li.bold.active > div > ul > li:nth-child(4) > a").should("be.visible").click();
    // document.querySelector("#slide-out > li > ul > li.bold.active > div > ul > li:nth-child(4) > a");
    // cy.wait(10000 as number);

    // Class
    let classList: number[] = [];
    cy.get("#app > div.application--wrap > div > div.v-card.v-sheet.theme--light > div > div > div:nth-child(1) > div").should("be.visible").click({ multiple: true });

    // Class Value
    recurse(
      () => cy.get(".menuable__content__active").scrollTo("bottom"),
      ($list) => {
        // Check if we can find an element with specific text or attribute
        const targetElement = $list.find(".v-select-list > .v-list > div:nth-child(129) > a"); // max
        // console.log("targetElement", $list, targetElement.length, targetElement.is(":visible"));
        return targetElement.length > 0 && targetElement.is(":visible");
      },
      {
        limit: 50,
        delay: 500,
        log: true,
        timeout: 5000,
        // Custom error message
        error: "Could not find the 28th child element after scrolling",
      }
    ).then(($list) => {
      // Success callback - element found

      const totalElements = $list.find(".v-select-list > .v-list").children().length; // max

      // classList = new Array(129).fill(1).map((a, i) => i);

      console.log("Found the 28th child element:", totalElements);
      cy.get(`.v-input > .v-menu__content > .v-select-list > .v-list > :nth-child(1)`).click();

      // loadDataForClassMonthYear(1, 1, 1);

      //load the #28 IC010
      // loadDataForClassMonthYear(startClass, 1, startYear);

      loadDataForClassMonthYear(120, 7, 4); // Loading Class 76, Month 8, Year 1
      // loadDataForClassMonthYear(76, 8, 1); // Loading Class 76, Month 8, Year 1
      // loadDataForClassMonthYear(73, 12, 2); // Loading Class 73, Month 12, Year 2
      // loadDataForClassMonthYear(50, 12, 4); // Loading Class 50, Month 12, Year 4
      // loadDataForClassMonthYear(50, 2, 3); // Loading Class 50, Month 2, Year 3
      // loadDataForClassMonthYear(34, 4, 1); // Loading Class 34, Month 4, Year 1
      // loadDataForClassMonthYear(28, 12, 3); // Loading Class 28, Month 12, Year 3
      // loadDataForClassMonthYear(27, 2, 2); // Loading Class 27, Month 2, Year 2
      // loadDataForClassMonthYear(18, 3, 3); // Loading Class 18, Month 3, Year 3
      // loadDataForClassMonthYear(11, 11, 1); // Loading Class 11, Month 11, Year 1
      // loadDataForClassMonthYear(23, 1, 1);

      // loadDataForClassMonthYear(1, 10, startYear);
    });

    // recurse(
    //   () => {
    //     console.log("selectedClassIndex", selectedClassIndex);
    //     return cy.get(".menuable__content__active").parent().next();
    //   },
    //   ($next) => {
    //     console.log("next", $next);
    //     return $next.length > 0;
    //   },
    //   {
    //     limit: 50,
    //     delay: 500,
    //     log: true,
    //     timeout: 5000,
    //     // Custom error message
    //     error: "Could not find the 28th child element after scrolling",
    //   }
    // ).then(($next) => {
    //   selectedClassIndex += 1;
    //   console.log("here", $next, selectedClassIndex);
    //   if ($next.length) {
    //     cy.wrap($next).find(".v-list__tile").click();

    //     // 🔹 do scraping here if needed
    //     cy.get("tbody > tr").then(($rows) => {
    //       cy.log(`Selected ${$next.text()}, found ${$rows.length} rows`);
    //     });
    //   }
    //   // cy.get("#app > div.application--wrap > div > div.v-card.v-sheet.theme--light > div > div > div:nth-child(1) > div").should("be.visible").click({ multiple: true });
    // });

    // cy.wrap($list).find(":nth-child(28)").should("be.visible").click();

    // cy.get("#app > div.application--wrap > div > div.v-card.v-sheet.theme--light > div > div > div:nth-child(1) > div").should("be.visible").click({ multiple: true });
    // cy.get(`.v-input > .v-menu__content > .v-select-list > .v-list > :nth-child(1)`).click();

    console.log("classList", classList);

    // cy.wait(10000 as number);
  });

  // it("Choose the class month year", () => {
  //   // Year
  //   // cy.get("#app > div.application--wrap > div > div.v-card.v-sheet.theme--light > div > div > div:nth-child(1) > div").should("be.visible").click({ multiple: true });

  //   // Month
  //   cy.get("#app > div.application--wrap > div > div.v-card.v-sheet.theme--light > div > div > div:nth-child(2) > div").should("be.visible").click({ multiple: true });

  //   cy.wait(10000 as number);
  // });
});

const loadDataForClassMonthYear = (classIndex: number, monthIndex: number, yearIndex: number) => {
  console.log(`Loading Class ${classIndex}, Month ${monthIndex}, Year ${yearIndex}`);

  // Class
  cy.get(":nth-child(1) > .v-input > .v-input__control > .v-input__slot > .v-select__slot > .v-select__selections").click({ multiple: true });

  // let classValue = "";
  // cy.get(`.menuable__content__active > .v-select-list > .v-list > :nth-child(${classIndex}) > .v-list__tile`).then(($class) => {
  //   classValue = $class.text().trim() || "";
  // });
  // cy.wait(200 as number);

  cy.get(`.v-input > .v-menu__content > .v-select-list > .v-list > :nth-child(${classIndex})`).click({ multiple: true });
  // cy.wait(200 as number);

  let classValue = "";
  cy.get(
    "#app > div.application--wrap > div > div.v-card.v-sheet.theme--light > div > div > div:nth-child(1) > div > div.v-input__control > div.v-input__slot > div.v-select__slot > div.v-select__selections > span"
  ).then(($value) => {
    // console.log($value.first().text().trim() || 0);
    classValue = $value.first().text().trim();
  });
  cy.wait(200 as number);

  // Month
  cy.get("#app > div.application--wrap > div > div.v-card.v-sheet.theme--light > div > div > div:nth-child(2) > div").should("exist").click({ multiple: true });
  // Month Value
  cy.get(`.menuable__content__active > .v-select-list > .v-list > :nth-child(${monthIndex}) > .v-list__tile`).should("exist").click({ multiple: true });
  let monthValue = 0;
  cy.get(
    "#app > div.application--wrap > div > div.v-card.v-sheet.theme--light > div > div > div:nth-child(2) > div > div.v-input__control > div.v-input__slot > div.v-select__slot > div.v-select__selections > span"
  ).then(($year) => {
    monthValue = parseInt($year.first().text().trim()) || 0;
  });
  cy.wait(200 as number);

  // cy.get(`:nth-child(${monthIndex}) > .v-input > .v-input__control > .v-input__slot > .v-select__slot > .v-select__selections > .v-chip > .v-chip__content`).then(($month) => {
  //   console.log("month", $month.text());
  //   monthValue = parseInt($month.text().trim()) || 0;
  // });

  // // Year
  cy.get("#app > div.application--wrap > div > div.v-card.v-sheet.theme--light > div > div > div:nth-child(3) > div").should("exist").click({ multiple: true });

  // let yearValue = cy.get(
  //   "#app > div.application--wrap > div > div.v-card.v-sheet.theme--light > div > div > div:nth-child(3) > div > div.v-input__control > div.v-input__slot > div.v-select__slot > div.v-select__selections > span"
  // ).
  // console.log("yearValue", yearValue);
  // Year Value
  cy.get(`.menuable__content__active > .v-select-list > .v-list > :nth-child(${yearIndex}) > .v-list__tile`).should("exist").click({ multiple: true });

  let yearValue = 0;
  cy.get(
    "#app > div.application--wrap > div > div.v-card.v-sheet.theme--light > div > div > div:nth-child(3) > div > div.v-input__control > div.v-input__slot > div.v-select__slot > div.v-select__selections > span"
  ).then(($year) => {
    yearValue = parseInt($year.first().text().trim()) || 0;
  });

  // Wait for the table to load
  cy.wait(2000);
  cy.get("body").then(($body) => {
    // cy.get(".v-card__title > :nth-child(1) > :nth-child(7) > :nth-child(1)", { timeout: 2000 });

    if ($body.find(".v-card__title > :nth-child(1) > :nth-child(7) > :nth-child(1)").length) {
      console.log("Element found — test continues");

      // Select the view all pages dropdown
      cy.get(".v-datatable__actions__select > .v-input > .v-input__control > .v-input__slot > .v-select__slot").should("be.visible").click({ multiple: true });

      // Select the view all pages dropdown item
      cy.get(".v-menu__content--auto > .v-select-list > .v-list > :last-child > .v-list__tile").should("be.visible").click();

      const cells: any = [];

      cy.get("tbody > tr")
        .should("be.visible")
        .each(($row, rowIndex) => {
          const localCells: {
            stt: string;
            studentName: string;
            tuition: {
              amount: number;
              refundAmount: number;
              paidIn: null | "monthly" | "package";
              moveToNextMonthAmount: number;
            };

            inDebt: string;
            doc: string;
            discount: number;
            addition: number;
            deductions: number;
            note: string;
            action: string;
          } = {
            stt: "",
            studentName: "",
            tuition: {
              amount: 0,
              refundAmount: 0,
              paidIn: null, // "monthly" | "package"
              moveToNextMonthAmount: 0,
            },
            inDebt: "",
            doc: "",
            discount: 0,
            addition: 0,
            deductions: 0,
            note: "",
            action: "",
          };

          // Loop all the td
          cy.wrap($row)
            .should("be.visible")
            .children()
            .each(($cell, cellIndex) => {
              if (cellIndex === 0) {
                localCells.stt = $cell.text().trim();
              }
              if (cellIndex === 1) {
                const domCell = $cell[0] as HTMLElement;

                // Get student name (first text node or <font>)
                const studentName = domCell.querySelector("font")?.textContent?.trim() || domCell.childNodes[0].textContent?.trim() || "";

                // Check icons
                const icons = Array.from(domCell.querySelectorAll("i font, i"));
                const hasCheck = icons.some((icon) => icon.textContent?.includes("check_circle_outline"));
                const hasStar = icons.some((icon) => icon.textContent?.includes("star_rate"));

                if (hasCheck && hasStar) {
                  localCells.tuition.paidIn = "package";
                } else if (hasCheck) {
                  localCells.tuition.paidIn = "monthly";
                } else {
                  localCells.tuition.paidIn = null;
                }

                // Check move to next month
                const moveToNextMonth = icons.some((icon) => icon.textContent?.includes("move_to_inbox"));
                if (moveToNextMonth) {
                  localCells.tuition.moveToNextMonthAmount = 0;
                }

                // Check if has redundant
                const hasRedundant = icons.some((icon) => icon.textContent?.includes("money_off"));
                if (hasRedundant) {
                  cy.wrap($cell)
                    .find('i:contains("money_off")')
                    .trigger("mouseenter")
                    .then(() => {
                      // const hoveredElement = document.getElementsByClassName("menuable__content__active");
                      // console.log("icons", hoveredElement);
                      // cy.log("aaa", cy.get(".menuable__content__active").should("be.visible"));

                      cy.get(".menuable__content__active", { timeout: 500 })
                        .should("be.visible")
                        .then((text) => {
                          // console.log("Trimmed tooltip text:", text.text());

                          // Extract date started
                          const dateMatch = text
                            .text()
                            .trim()
                            .match(/(\d{2}\/\d{2}\/\d{4})/);
                          const date = dateMatch ? dateMatch[1] : null;

                          // Extract amount
                          const amountMatch = text
                            .text()
                            .trim()
                            .match(/([\d.,]+)\s*VND/);
                          const amount = amountMatch ? amountMatch[1] : null;

                          localCells.tuition.refundAmount = parseInt(amount.replace(/\./g, "").replace(/[^\d]/g, ""), 10);
                          cy.wrap($cell).find('i:contains("money_off")').trigger("mouseleave");
                        });
                    });
                }

                //--- Get the student name
                localCells.studentName = studentName;

                if (localCells.studentName.length === 0) {
                  console.log(">>>>", $cell);
                  alert("no name");
                }
              }
              if (cellIndex === 2) {
                localCells.tuition.amount = parseInt($cell.text().trim().replace(/\./g, "").replace(/[^\d]/g, ""), 10);
              }
              if (cellIndex === 3) {
                localCells.inDebt = $cell.text().trim();
              }
              if (cellIndex === 4) {
                localCells.doc = ($cell[0] as HTMLElement).childNodes[0].textContent?.trim() || "";
              }
              if (cellIndex === 5) {
                const domCell = $cell[0] as HTMLElement;
                // const studentName = domCell.querySelector("font")?.textContent?.trim() || domCell.childNodes[0].textContent?.trim() || "";

                const discount = domCell.getElementsByClassName("v-chip__content")[0]?.textContent.trim() || "0";
                //domCell.getElementsByClassName("v-chip__content")[0]?.textContent?.trim(); // || domCell.childNodes[0]?.textContent?.trim() || "0";
                // console.log(
                //   "discount>",
                //   localCells.studentName + " " + discount,
                //   domCell.childNodes[0],
                //   domCell.getElementsByClassName("v-chip__content")[0]?.textContent.trim() || "0"
                // );

                localCells.discount = parseInt(discount);
              }
              if (cellIndex === 6) {
                const domCell = $cell[0] as HTMLElement;
                const bonus = domCell.getElementsByTagName("input")[0]?.value?.trim();
                localCells.addition = parseInt(bonus);
                // console.log(localCells.studentName + " " + bonus);
              }
              if (cellIndex === 7) {
                const domCell = $cell[0] as HTMLElement;
                const bonus = domCell.getElementsByTagName("input")[0]?.value?.trim();
                localCells.deductions = parseInt(bonus);
              }
              if (cellIndex === 8) {
                localCells.note = ($cell[0] as HTMLElement).childNodes[0].textContent?.trim() || "";
              }
              if (cellIndex === 9) {
                localCells.action = $cell.text().trim();
              }
            })
            .then(() => {
              cells.push(localCells);
            });
        })
        .then(() => {
          console.log("done all cells", cells, {
            classValue: classValue,
            monthValue: monthValue,
            yearValue: yearValue,
          });
          // alert(classValue + " " + monthValue + " " + yearValue);
          cy.request({
            method: "POST",
            url: "http://localhost:3000/api/v1/migrations/tuition", // full URL or relative to baseUrl
            body: {
              data: {
                classIndex: classIndex,
                monthIndex: monthIndex,
                yearIndex: yearIndex,

                classValue: classValue,
                monthValue: monthValue,
                yearValue: yearValue,

                data: cells,
              },
            },
            headers: {
              "Content-Type": "application/json",
            },
          }).then((response) => {
            console.log("Response:", JSON.stringify(response.body));

            LoadNext(classIndex, monthIndex, yearIndex);
          });
        });
    } else {
      console.log("Element not found — skipping click");

      LoadNext(classIndex, monthIndex, yearIndex);
    }
  });
};

const LoadNext = (classIndex: number, monthIndex: number, yearIndex: number) => {
  if (yearIndex < totalOfYears) {
    console.log("▶ load again for year", classIndex, monthIndex, yearIndex + 1);
    loadDataForClassMonthYear(classIndex, monthIndex, yearIndex + 1);
  } else if (monthIndex < totalOfMonths) {
    console.log("▶ load again for month", classIndex, monthIndex + 1, startYear);
    loadDataForClassMonthYear(classIndex, monthIndex + 1, startYear);
  } else if (classIndex < totalOfClass) {
    console.log("▶ load again for class", classIndex + 1, 1, startYear);
    loadDataForClassMonthYear(classIndex + 1, 1, startYear);
  } else {
    console.log("🎉 Finished all classes, months, and years", classIndex, monthIndex, yearIndex);
  }
};
