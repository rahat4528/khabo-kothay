"""Application Configuration and Feature Flags for Khabo Kothay? API."""

from pydantic import Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Khabo Kothay? API"
    version: str = "1.1.0"
    timezone: str = "Asia/Dhaka"
    environment: str = "development"
    api_v1_prefix: str = "/api/v1"

    # Feature Flags (Android Blueprint v4)
    flag_outing_cost: bool = Field(default=True, alias="FLAG_OUTING_COST")
    flag_closing_alerts: bool = Field(default=True, alias="FLAG_CLOSING_ALERTS")
    flag_budget_tracker: bool = Field(default=True, alias="FLAG_BUDGET_TRACKER")
    flag_occasion_filters: bool = Field(default=True, alias="FLAG_OCCASION_FILTERS")
    flag_home_widget: bool = Field(default=True, alias="FLAG_HOME_WIDGET")
    flag_parking_access: bool = Field(default=True, alias="FLAG_PARKING_ACCESS")
    flag_hidden_gems: bool = Field(default=False, alias="FLAG_HIDDEN_GEMS")
    flag_seasonal_guides: bool = Field(default=True, alias="FLAG_SEASONAL_GUIDES")
    flag_dish_search: bool = Field(default=True, alias="FLAG_DISH_SEARCH")
    flag_want_to_try: bool = Field(default=True, alias="FLAG_WANT_TO_TRY")
    flag_geofence_reminders: bool = Field(
        default=False, alias="FLAG_GEOFENCE_REMINDERS"
    )

    # Financial / Tax Defaults (Placeholders for Bangladesh)
    default_vat_pct: float = 15.0
    default_service_pct: float = 5.0
    default_parking_fee_bdt: float = 0.0

    # Rate Limiting & Usage Guard
    daily_google_request_cap: int = 1000
    device_daily_search_limit: int = 50

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
