"""Small dependency-free smoke test used by CI to validate the backend package."""

from app.main import app


def main() -> None:
    routes = {getattr(route, "path", None) for route in app.routes}
    required = {"/api/health", "/api/dashboard", "/api/cameras", "/api/incidents", "/api/events"}
    missing = required - routes
    if missing:
        raise SystemExit(f"Missing required API routes: {sorted(missing)}")
    print(f"Backend application loaded successfully with {len(app.routes)} routes")


if __name__ == "__main__":
    main()
