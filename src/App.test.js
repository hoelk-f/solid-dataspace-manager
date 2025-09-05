import { render, screen } from "@testing-library/react";
import React from "react";

jest.mock("react-router-dom", () => ({
  BrowserRouter: ({ children }) => <div>{children}</div>,
  Routes: ({ children }) => <div>{children}</div>,
  Route: () => null,
}), { virtual: true });

import App from "./App";

test("renders login screen", () => {
  render(<App />);
  const title = screen.getByText(/Solid Dataspace Manager/i);
  expect(title).toBeInTheDocument();
});
