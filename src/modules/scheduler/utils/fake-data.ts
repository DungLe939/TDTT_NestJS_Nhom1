interface MenuItem {
    name: string;
    price: number;
    description: string;
    isSignature?: boolean;
}

export const fakeRemainingData = (rawRestaurants: any[], guestId: string) => {
    const pools: Record<string, MenuItem[]> = {
        restaurant: [
            { name: "Cơm tấm sườn bì chả", price: 55000, description: "Sườn nướng than hồng, vị đậm đà truyền thống" },
            { name: "Phở bò tái nạm", price: 65000, description: "Nước dùng trong thanh, bò mềm" },
            { name: "Bún bò Huế", price: 70000, description: "Vị cay nồng, chân giò và chả cua" },
            // ... Copy toàn bộ list restaurant của bạn vào đây
        ],
        cafe: [
            { name: "Cà phê sữa đá", price: 25000, description: "Robusta đậm đà" },
            { name: "Trà đào cam sả", price: 45000, description: "Đào miếng giòn ngọt" },
            // ... Copy toàn bộ list cafe của bạn vào đây
        ],
        pub: [
            { name: "Bia Tiger bạc", price: 35000, description: "Dễ uống, sảng khoái" },
            { name: "Cocktail Mojito", price: 110000, description: "Chanh và bạc hà" },
            // ... Copy toàn bộ list pub của bạn vào đây
        ]
    };

    return rawRestaurants.map(res => {
        const cuisineLower = res.cuisine.toLowerCase();
        const category = pools[cuisineLower] ? cuisineLower : 'restaurant';
        const currentPool = pools[category];

        const menuSize = Math.floor(Math.random() * 3) + 3;
        const shuffledMenu = [...currentPool]
            .sort(() => Math.random() - 0.5)
            .slice(0, menuSize)
            .map(item => ({
                ...item,
                price: item.price + (Math.floor(Math.random() * 11) - 5) * 1000,
                isSignature: Math.random() > 0.8
            }));

        return {
            ...res,
            category: category.charAt(0).toUpperCase() + category.slice(1),
            priceRange: category === 'cafe' ? 1 : Math.floor(Math.random() * 2) + 2,
            rating: parseFloat((Math.random() * 1.5 + 3.5).toFixed(1)),
            menu: shuffledMenu,
            openingHours: {
                open: category === 'cafe' ? "06:30" : "10:00",
                close: category === 'pub' ? "23:59" : "22:00"
            },
            guest_id: guestId,
            createdAt: new Date().toISOString()
        };
    });
};