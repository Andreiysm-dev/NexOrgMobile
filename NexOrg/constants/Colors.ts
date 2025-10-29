/**
 * NexOrg Color Scheme - Maroon and White Theme with Dark Mode Support
 * Primary: Maroon accents, Secondary: Grays, Background: White/Dark
 */

const nexOrgMaroon = '#800020'; // Main maroon color
const nexOrgDarkMaroon = '#5D0017'; // Darker maroon for selections
const nexOrgLightMaroon = '#A0002B'; // Lighter maroon for highlights
const nexOrgGray = '#6B7280'; // Gray text
const nexOrgLightGray = '#F8F9FA'; // Light gray backgrounds
const nexOrgDarkGray = '#374151'; // Dark gray text

export const Colors = {
  light: {
    text: '#1F2937', // Dark gray for main text
    background: '#FFFFFF', // White background
    tint: nexOrgMaroon, // Maroon for active states
    icon: nexOrgGray, // Gray for inactive icons
    tabIconDefault: nexOrgGray,
    tabIconSelected: nexOrgMaroon,
    card: '#FFFFFF', // White cards
    border: '#E5E7EB', // Light gray borders
    sidebar: '#FEFEFE', // Very light gray for sidebar
    accent: nexOrgDarkMaroon, // Darker maroon for buttons
    textSecondary: nexOrgGray, // Secondary text color
    maroonLight: nexOrgLightMaroon, // Light maroon variant
  },
  dark: {
    text: '#D7DADC', // Reddit-style light text for dark mode
    background: '#1A1A1B', // Reddit-style dark background
    tint: nexOrgMaroon, // Keep maroon for consistency
    icon: '#818384', // Reddit-style muted icons
    tabIconDefault: '#818384',
    tabIconSelected: nexOrgMaroon,
    card: '#1A1A1B', // Same as background for consistency
    border: '#343536', // Reddit-style dark borders
    sidebar: '#1A1A1B', // Same as background for consistency
    accent: nexOrgMaroon, // Keep maroon for buttons
    textSecondary: '#818384', // Reddit-style muted text
    maroonLight: nexOrgLightMaroon, // Consistent light maroon
  },
};
