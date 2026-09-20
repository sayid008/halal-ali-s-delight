import chickenPakora from "@/assets/dish-chicken-pakora.jpg";
import onionBhaji from "@/assets/dish-onion-bhaji.jpg";
import chickenTikkaSkewers from "@/assets/dish-chicken-tikka-skewers.jpg";
import mixedGrill from "@/assets/dish-mixed-grill.jpg";
import lambKarahi from "@/assets/dish-lamb-karahi.jpg";
import daalTarka from "@/assets/dish-daal-tarka.jpg";
import chickenBiryani from "@/assets/dish-chicken-biryani.jpg";
import pilauRice from "@/assets/dish-pilau-rice.jpg";
import garlicNaan from "@/assets/dish-garlic-naan.jpg";
import mintRaita from "@/assets/dish-mint-raita.jpg";
import gulabJamun from "@/assets/dish-gulab-jamun.jpg";
import kheer from "@/assets/dish-kheer.jpg";
import mangoLassi from "@/assets/dish-mango-lassi.jpg";
import masalaChai from "@/assets/dish-masala-chai.jpg";
import seekhKebab from "@/assets/dish-seekh-kebab.jpg";
import butterChicken from "@/assets/dish-butter-chicken.jpg";
import naan from "@/assets/dish-naan.jpg";
import tikkaMasala from "@/assets/dish-tikka-masala.jpg";
import samosa from "@/assets/dish-samosa.jpg";
import biryani from "@/assets/hero-biryani.jpg";

export type MenuItem = {
  name: string;
  description: string;
  price: string | number;
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
        image: chickenPakora,
      },
      {
        name: "Onion Bhaji",
        description: "Sweet onion, cumin and coriander, fried golden.",
        price: "£5.50",
        image: onionBhaji,
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
        image: chickenTikkaSkewers,
      },
      {
        name: "Mixed Grill Platter",
        description: "Seekh kebab, chicken tikka, lamb chop and grilled wings for two.",
        price: "£24.00",
        image: mixedGrill,
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
        image: lambKarahi,
      },
      {
        name: "Daal Tarka",
        description: "Yellow lentils finished with cumin-tempered ghee.",
        price: "£9.50",
        image: daalTarka,
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
        image: chickenBiryani,
      },
      {
        name: "Pilau Rice",
        description: "Basmati steamed with whole spices.",
        price: "£3.50",
        image: pilauRice,
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
        image: garlicNaan,
      },
      {
        name: "Mint Raita",
        description: "Cool yoghurt, cucumber and fresh mint.",
        price: "£2.50",
        image: mintRaita,
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
        image: gulabJamun,
      },
      {
        name: "Kheer",
        description: "Slow-cooked rice pudding with pistachio.",
        price: "£4.50",
        image: kheer,
      },
      {
        name: "Mango Lassi",
        description: "Yoghurt blended with sweet Alphonso mango.",
        price: "£3.50",
        image: mangoLassi,
      },
      {
        name: "Masala Chai",
        description: "Spiced black tea brewed with milk.",
        price: "£2.50",
        image: masalaChai,
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
