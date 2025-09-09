import React from 'react';

type IconProps = {
  className?: string;
};

export const EditIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" />
  </svg>
);

export const DeleteIcon: React.FC<IconProps> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

export const PlusIcon: React.FC<IconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
);

export const LogoutIcon: React.FC<IconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
);

export const CopyIcon: React.FC<IconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
);

export const ClearIcon: React.FC<IconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
);

export const BookmarkIcon: React.FC<IconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
    </svg>
);

export const BookmarkFilledIcon: React.FC<IconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 20 20" fill="currentColor">
        <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
    </svg>
);

export const InfoIcon: React.FC<IconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinejoin="round" strokeLinecap="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
    </svg>
);

export const AiIcon: React.FC<IconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 132 132">
        <path d="M60.1595 60.9257L18.7605 102.325C15.7465 105.339 15.7465 110.226 18.7605 113.24C21.7746 116.254 26.6613 116.254 29.6754 113.24L71.0743 71.8405M60.1595 60.9257L71.0743 71.8405M60.1595 60.9257L64.2526 56.8326M71.0743 71.8405L75.1674 67.7474M64.2526 56.8326L64.4864 56.5983C66.6182 54.4672 70.0733 54.4672 72.2045 56.5983L75.4017 59.7955C77.5329 61.9267 77.5329 65.3818 75.4017 67.5131L75.1674 67.7474M64.2526 56.8326L75.1674 67.7474" stroke="currentColor" strokeWidth="8.25" strokeLinejoin="round"/>
        <path d="M100.307 17.4189C100.879 16.1937 102.621 16.1937 103.193 17.4189L105.348 22.0356C106.296 24.069 107.931 25.7035 109.964 26.6525L114.581 28.8071C115.806 29.3789 115.806 31.1211 114.581 31.6929L109.964 33.8475C107.931 34.7965 106.296 36.431 105.348 38.4644L103.193 43.0811C102.621 44.3063 100.879 44.3063 100.307 43.0811L98.1524 38.4644C97.2037 36.431 95.5691 34.7965 93.5357 33.8475L88.919 31.6929C87.6936 31.1211 87.6936 29.3789 88.919 28.8071L93.5356 26.6525C95.5691 25.7035 97.2037 24.069 98.1524 22.0356L100.307 17.4189Z" stroke="currentColor" strokeWidth="8.25" strokeLinejoin="round"/>
        <path d="M100.307 77.919C100.879 76.6936 102.621 76.6936 103.193 77.919L105.348 82.5358C106.296 84.5691 107.931 86.2037 109.964 87.1524L114.581 89.3073C115.806 89.8788 115.806 91.6212 114.581 92.1927L109.964 94.3476C107.931 95.2963 106.296 96.9309 105.348 98.9642L103.193 103.581C102.621 104.806 100.879 104.806 100.307 103.581L98.1524 98.9642C97.2037 96.9309 95.5691 95.2963 93.5357 94.3476L88.919 92.1927C87.6936 91.6212 87.6936 89.8788 88.919 89.3073L93.5357 87.1524C95.5691 86.2037 97.2037 84.5691 98.1524 82.5358L100.307 77.919Z" stroke="currentColor" strokeWidth="8.25" strokeLinejoin="round"/>
        <path d="M39.8071 17.4189C40.3789 16.1937 42.1211 16.1937 42.6929 17.4189L44.8475 22.0356C45.7965 24.069 47.431 25.7035 49.4644 26.6525L54.0811 28.8071C55.3063 29.3789 55.3063 31.1211 54.0811 31.6929L49.4644 33.8475C47.431 34.7965 45.7965 36.431 44.8475 38.4644L42.6929 43.0811C42.1211 44.3063 40.3789 44.3063 39.8071 43.0811L37.6525 38.4644C36.7035 36.431 35.069 34.7965 33.0356 33.8475L28.4189 31.6929C27.1937 31.1211 27.1937 29.3789 28.4189 28.8071L33.0356 26.6525C35.069 25.7035 36.7035 24.069 37.6525 22.0356L39.8071 17.4189Z" stroke="currentColor" strokeWidth="8.25" strokeLinejoin="round"/>
    </svg>
);

export const InstallIcon: React.FC<IconProps> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
);