//this controls the navigation between different pages of the application

import { createBrowserRouter, Navigate } from "react-router-dom";                     //Navigate - redirects users from one URL to another
import AppLayout from "../components/layout/AppLayout.tsx";                           //AppLayout - this provides the common layout that is shared across pages like the sidebar

//below we are importing the individual page components
import Dashboard from "../pages/page1_dashboard/Dashboard";       
import MaterialLibrary from "../pages/page2_material_library/MaterialLibrary";
import SingleLayer from "../pages/page3_single_layer/SingleLayer";
import Multilayer from "../pages/page4_multilayer/Multilayer";
import FrequencyAnalysis from "../pages/page5_frequency_analysis/FrequencyAnalysis";
import Optimization from "../pages/page6_optimization/Optimization";
import ResultsExport from "../pages/page7_results_export/ResultsExport";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,                                 
    children: [                                                                     //defines the pages displayed in the shared applayout
      {
        index: true,                                                                //this makes the dashboard page the default one when someone visits the '/'
        element: <Dashboard />,
      },
      {
        path: "materials",
        element: <MaterialLibrary />,
      },
      {
        path: "single-layer",
        element: <SingleLayer />,
      },
      {
        path: "multilayer",
        element: <Multilayer />,
      },
      {
        path: "frequency-analysis",
        element: <FrequencyAnalysis />,
      },
      {
        path: "optimization",
        element: <Optimization />,
      },
      {
        path: "results",
        element: <ResultsExport />,
      },
      {
        path: "*",                                                                  //navigates any other unknown url to the dashboard page
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);
