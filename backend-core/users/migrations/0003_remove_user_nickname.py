# Generated manually: remove nickname field, use username for display

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0002_alter_user_manner_score'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='user',
            name='nickname',
        ),
    ]
