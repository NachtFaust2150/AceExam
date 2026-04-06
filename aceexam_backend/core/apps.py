from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'

    def ready(self):
        from .db import seed_data
        try:
            seed_data()
        except Exception:
            pass
