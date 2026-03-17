import { ChartType } from "./admin-dashboard.component";

export const IncomeAndExpense: ChartType = {
  series: [
    {
      name: "Income",
      type: "column",
      data: [],
      //  [30, 48, 28, 74, 39, 87, 54, 36, 50, 87, 84, 36, 50, 87, 84]
    },
    {
      name: "Expenses",
      type: "column",
      data: [],
      // [20, 50, 42, 10, 24, 28, 60, 35, 47, 64, 78],
    },
    // {
    //   name: 'Total Jobs',
    //   type: 'area',
    //   data: [44, 55, 41, 67, 22, 43, 21, 41, 56, 27, 43],
    // },
    // {
    //   name: 'Job View',
    //   type: 'line',
    //   data: [30, 25, 36, 30, 45, 35, 64, 52, 59, 36, 39],
    // },
  ],
  chart: {
    height: 350,
    type: "line",
    stacked: false,
    toolbar: {
      show: false,
    },
  },
  legend: {
    show: true,
    offsetY: 10,
  },
  stroke: {
    width: [0, 0, 2, 1],
    curve: "smooth",
  },
  plotOptions: {
    bar: {
      columnWidth: "30%",
    },
  },
  fill: {
    opacity: [1, 1, 0.1, 1],
    gradient: {
      inverseColors: false,
      shade: "light",
      type: "vertical",
      opacityFrom: 0.85,
      opacityTo: 0.55,
      stops: [0, 100, 100, 100],
    },
  },
  labels: [
    // '01/2022',
    // '02/2022',
  ],
  dataLabels: {
    enabled: false,
  },
  colors: ["#34c38f", "#ff5a5f"],
  markers: {
    size: 0,
  },
  tooltip: {
    shared: true,
    intersect: false,
    y: {
      formatter: function (y: any) {
        if (typeof y !== "undefined") {
          return y.toLocaleString(undefined, { style: "currency", currency: "VND" });
        }
        return y;
      },
    },
  },
};
