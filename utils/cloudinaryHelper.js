const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const getCloudinaryPublicId = (url) => {
  if (!url || !url.includes('cloudinary.com')) return null;
  try {
    const parts = url.split('/upload/');
    if (parts.length < 2) return null;
    
    let publicIdWithExt = parts[1];
    if (publicIdWithExt.startsWith('v')) {
      const slashIndex = publicIdWithExt.indexOf('/');
      if (slashIndex !== -1) {
        publicIdWithExt = publicIdWithExt.substring(slashIndex + 1);
      }
    }
    
    const dotIndex = publicIdWithExt.lastIndexOf('.');
    if (dotIndex !== -1) {
      return publicIdWithExt.substring(0, dotIndex);
    }
    return publicIdWithExt;
  } catch (err) {
    console.error('Error parsing Cloudinary public ID:', err);
    return null;
  }
};

const deleteCloudinaryFile = async (url) => {
  const publicId = getCloudinaryPublicId(url);
  if (!publicId) return;
  try {
    const resourceType = url.includes('/raw/upload/') ? 'raw' : 'image';
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    console.log(`Successfully deleted Cloudinary file: ${publicId}`);
  } catch (err) {
    console.error(`Failed to delete Cloudinary file: ${publicId}`, err);
  }
};

module.exports = { deleteCloudinaryFile };
