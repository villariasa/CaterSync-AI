from django.db import models
import uuid


class Organization(models.Model):
    """
    Organization model mapped to existing organizations table.
    Represents a tenant in the multi-tenant architecture.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=100, unique=True)
    address = models.TextField(blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    website = models.URLField(max_length=255, blank=True, null=True)
    logo_url = models.URLField(max_length=500, blank=True, null=True)
    
    SUBSCRIPTION_PLANS = [
        ('basic', 'Basic'),
        ('premium', 'Premium'),
        ('enterprise', 'Enterprise'),
    ]
    subscription_plan = models.CharField(
        max_length=50, 
        choices=SUBSCRIPTION_PLANS, 
        default='basic'
    )
    
    SUBSCRIPTION_STATUSES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('suspended', 'Suspended'),
        ('cancelled', 'Cancelled'),
    ]
    subscription_status = models.CharField(
        max_length=20, 
        choices=SUBSCRIPTION_STATUSES, 
        default='active'
    )
    
    subscription_expires_at = models.DateTimeField(blank=True, null=True)
    settings = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        managed = False  # Table is managed by SQL migrations
        db_table = 'organizations'
        ordering = ['name']

    def __str__(self):
        return self.name

    @property
    def is_active(self):
        """Check if organization subscription is active."""
        return self.subscription_status == 'active'

    def soft_delete(self):
        """Soft delete the organization."""
        from django.utils import timezone
        self.deleted_at = timezone.now()
        self.save(update_fields=['deleted_at'])
