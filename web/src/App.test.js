import { render } from '@testing-library/react';

jest.mock('react-router-dom', () => ({
  BrowserRouter: ({ children }) => <div data-testid="browser-router">{children}</div>,
  Navigate: ({ to }) => <span data-testid="navigate">{to}</span>,
  NavLink: ({ children, to }) => <a href={to}>{children}</a>,
  Link: ({ children, to }) => <a href={to}>{children}</a>,
  Route: ({ element, path }) => <div data-route-path={path}>{element}</div>,
  Routes: ({ children }) => <div data-testid="routes">{children}</div>,
  useLocation: () => ({ state: null }),
  useNavigate: () => jest.fn(),
  useParams: () => ({}),
}), { virtual: true });

import App from './App';

test('registers the public accreditor access route', () => {
  const { container } = render(<App />);

  expect(container.querySelector('[data-route-path="/accreditor-access/:token"]')).toBeInTheDocument();
});
