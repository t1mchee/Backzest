"""SSL certificate fix for macOS."""
import ssl
import certifi

# Set default SSL context to use certifi's certificates
ssl._create_default_https_context = ssl._create_unverified_context

