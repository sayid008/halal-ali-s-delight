import seekhKebab from "@/assets/dish-seekh-kebab.jpg";
import butterChicken from "@/assets/dish-butter-chicken.jpg";
import naan from "@/assets/dish-naan.jpg";
import tikkaMasala from "@/assets/dish-tikka-masala.jpg";
import samosa from "@/assets/dish-samosa.jpg";
import biryani from "@/assets/hero-biryani.jpg";

export type MenuItem = {
  name: string;
  description: string;
  price: string;
  image?: string;
};

export type MenuSection = {
  id: string;
  title: string;
  items: MenuItem[];
};

export const chefSpecials: MenuItem[] = [
  {
    name: "Lamb Seekh Kebab",
    description: "Minced lamb infused with Ali's signature spice blend, flame-grilled.",
    price: "£8.50",
    image: seekhKebab,
  },
  {
    name: "Classic Butter Chicken",
    description: "Tender tandoori chicken simmered in a rich tomato and fenugreek gravy.",
    price: "£14.00",
    image: butterChicken,
  },
  {
    name: "Peshwari Naan",
    description: "Leavened bread stuffed with sweet sultanas, almonds, and coconut.",
    price: "£4.50",
    image: naan,
  },
];

export const menuSections: MenuSection[] = [
  {
    id: "starters",
    title: "Starters",
    items: [
      {
        name: "Vegetable Samosas",
        description: "Hand-folded pastry with spiced peas and potato, tamarind chutney.",
        price: "£6.50",
        image: samosa,
      },
      {
        name: "Chicken Pakora",
        description: "Gram flour batter, crisp fried, served with mint raita.",
        price: "£7.00",
      },
      {
        name: "Onion Bhaji",
        description: "Sweet onion, cumin and coriander, fried golden.",
        price: "£5.50",
      },
    ],
  },
  {
    id: "grill",
    title: "Main Grill",
    items: [
      {
        name: "Lamb Seekh Kebab",
        description: "Minced lamb infused with Ali's signature spice blend, flame-grilled.",
        price: "£8.50",
        image: seekhKebab,
      },
      {
        name: "Chicken Tikka Skewers",
        description: "Yoghurt and paprika marinade, charred over charcoal.",
        price: "£11.50",
      },
      {
        name: "Mixed Grill Platter",
        description: "Seekh kebab, chicken tikka, lamb chop and grilled wings for two.",
        price: "£24.00",
      },
    ],
  },
  {
    id: "curries",
    title: "Curries",
    items: [
      {
        name: "Classic Butter Chicken",
        description: "Tender tandoori chicken simmered in a rich tomato and fenugreek gravy.",
        price: "£14.00",
        image: butterChicken,
      },
      {
        name: "Chicken Tikka Masala",
        description: "Mild, creamy masala sauce with charred chicken tikka.",
        price: "£13.50",
        image: tikkaMasala,
      },
      {
        name: "Lamb Karahi",
        description: "Slow-cooked lamb with tomato, ginger and green chilli.",
        price: "£15.00",
      },
      {
        name: "Daal Tarka",
        description: "Yellow lentils finished with cumin-tempered ghee.",
        price: "£9.50",
      },
    ],
  },
  {
    id: "biryani",
    title: "Biryani & Rice",
    items: [
      {
        name: "Royal Lamb Biryani",
        description: "Slow-cooked lamb, long-grain basmati, saffron and fried onion.",
        price: "£16.00",
        image: biryani,
      },
      {
        name: "Chicken Biryani",
        description: "Layered basmati with spiced chicken and boiled egg.",
        price: "£14.00",
      },
      {
        name: "Pilau Rice",
        description: "Basmati steamed with whole spices.",
        price: "£3.50",
      },
    ],
  },
  {
    id: "breads",
    title: "Breads & Sides",
    items: [
      {
        name: "Peshwari Naan",
        description: "Leavened bread stuffed with sweet sultanas, almonds, and coconut.",
        price: "£4.50",
        image: naan,
      },
      {
        name: "Garlic Naan",
        description: "Fresh from the tandoor with garlic butter and coriander.",
        price: "£3.75",
      },
      {
        name: "Mint Raita",
        description: "Cool yoghurt, cucumber and fresh mint.",
        price: "£2.50",
      },
    ],
  },
  {
    id: "desserts",
    title: "Desserts & Drinks",
    items: [
      {
        name: "Gulab Jamun",
        description: "Warm milk dumplings soaked in cardamom syrup.",
        price: "£5.00",
      },
      {
        name: "Kheer",
        description: "Slow-cooked rice pudding with pistachio.",
        price: "£4.50",
      },
      {
        name: "Mango Lassi",
        description: "Yoghurt blended with sweet Alphonso mango.",
        price: "£3.50",
      },
      {
        name: "Masala Chai",
        description: "Spiced black tea brewed with milk.",
        price: "£2.50",
      },
    ],
  },
];

export const restaurant = {
  name: "Halal Ali Dine Inn & Take Away",
  short: "Ali Dine Inn",
  address: "124 High Street, London E1 6QL",
  phone: "020 7946 0912",
  hours: "Mon–Sun: 12:00 PM – 11:00 PM",
};
