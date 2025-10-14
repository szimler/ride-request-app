// Get the current page URL for the vCard QR code
const currentUrl = window.location.origin;
const vcardUrl = `${currentUrl}/api/vcard`;

// Generate QR code using Google Charts API
function generateQRCode() {
    const qrCodeImg = document.getElementById('qrCode');
    const size = 200;
    
    // QR code points to the vCard download URL
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(vcardUrl)}&format=png`;
    
    qrCodeImg.src = qrUrl;
}

// Share functionality
document.getElementById('shareBtn').addEventListener('click', async () => {
    const shareData = {
        title: 'Rides CEL - Digital Business Card',
        text: 'Save my contact and request a ride anytime!',
        url: window.location.href
    };

    try {
        if (navigator.share) {
            await navigator.share(shareData);
        } else {
            // Fallback to copy link if share is not supported
            copyLink();
        }
    } catch (err) {
        console.log('Error sharing:', err);
        copyLink();
    }
});

// Copy link functionality
document.getElementById('copyLinkBtn').addEventListener('click', () => {
    copyLink();
});

function copyLink() {
    const url = window.location.href;
    
    // Create temporary input element
    const tempInput = document.createElement('input');
    tempInput.value = url;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    
    // Show confirmation
    const confirmation = document.getElementById('copyConfirmation');
    confirmation.classList.remove('hidden');
    confirmation.classList.add('show');
    
    setTimeout(() => {
        confirmation.classList.remove('show');
        setTimeout(() => {
            confirmation.classList.add('hidden');
        }, 300);
    }, 2000);
}

// Initialize QR code when page loads
document.addEventListener('DOMContentLoaded', () => {
    generateQRCode();
});

// Add save contact button analytics (optional)
document.querySelector('.btn-primary').addEventListener('click', () => {
    console.log('Contact saved');
});

// Add request ride button analytics (optional)
document.querySelector('.btn-secondary').addEventListener('click', () => {
    console.log('Redirecting to ride request');
});

