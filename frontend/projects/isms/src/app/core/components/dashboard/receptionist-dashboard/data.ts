import { ChartType } from "../admin-dashboard/admin-dashboard.component";

export const GenderChart: ChartType = {
  chart: {
    height: 320,
    type: "pie",
  },
  series: [0, 0],
  labels: ["Male", "Female"],
  colors: ["#34c38f", "#556ee6"],
  legend: {
    show: true,
    position: "bottom",
    horizontalAlign: "center",
    verticalAlign: "middle",
    floating: false,
    fontSize: "14px",
    offsetX: 0,
    offsetY: -10,
  },
  responsive: [
    {
      breakpoint: 600,
      options: {
        chart: {
          height: 240,
        },
        legend: {
          show: false,
        },
      },
    },
  ],
};
