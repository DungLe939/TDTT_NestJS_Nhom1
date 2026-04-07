import { MenuItemDto } from "../../restaurants/dto/menu-item.dto";
import { RestaurantDto } from "../../restaurants/dto/restaurant.dto";

export const fakeRemainingData = (rawRestaurants: any[], guestId: string) => {
    const pools: Record<string, MenuItemDto[]> = {
        restaurant: [
            // --- CƠM, MÌ, PHỞ (ĂN NO) ---
            { name: "Cơm tấm sườn bì chả", price: 55000, description: "Sườn nướng than hồng, vị đậm đà truyền thống" },
            { name: "Cơm chiên dương châu", price: 65000, description: "Cơm tơi, nhiều lạp xưởng và đậu Hà Lan" },
            { name: "Cơm gà Hải Nam", price: 75000, description: "Gà luộc da giòn, cơm nấu nước dùng gà" },
            { name: "Cơm niêu cá kho tộ", price: 110000, description: "Cơm cháy giòn, cá kho đậm đà" },
            { name: "Bún chả Hà Nội", price: 60000, description: "Thịt nướng thơm nức, nước mắm đu đủ" },
            { name: "Phở bò tái nạm", price: 65000, description: "Nước dùng trong thanh, bò mềm" },
            { name: "Bún bò Huế", price: 70000, description: "Vị cay nồng, chân giò và chả cua" },
            { name: "Mì Quảng gà chọi", price: 55000, description: "Sợi mì vàng, nước sâm sấp đậm đà" },
            { name: "Hủ tiếu Nam Vang", price: 65000, description: "Tôm, thịt băm và trứng cút" },
            { name: "Bún đậu mắm tôm", price: 85000, description: "Mẹt đầy đủ chả cốm, dồi sụn" },
            { name: "Bún riêu cua đồng", price: 45000, description: "Riêu cua thật, đậu hũ và huyết" },
            { name: "Bánh canh cá lóc", price: 40000, description: "Sợi bánh canh dai, cá lóc đồng thơm" },
            { name: "Mì trộn tên lửa", price: 50000, description: "Mì trộn muối ớt, xá xíu và trứng lòng đào" },
            { name: "Cơm hến Cố Đô", price: 35000, description: "Hến xào thơm, ăn kèm tóp mỡ giòn" },
            { name: "Bún kèn Phú Quốc", price: 45000, description: "Nước dùng cốt dừa, cá xay nhuyễn" },
            // --- HẢI SẢN & ĐỒ NHẬU ---
            { name: "Lẩu cá đuối măng chua", price: 250000, description: "Đặc sản biển, vị chua thanh" },
            { name: "Gỏi cá mai", price: 120000, description: "Cá tươi bóp chanh, thính thơm" },
            { name: "Tôm hùm nướng phô mai", price: 450000, description: "Tôm hùm tươi, lớp phô mai béo ngậy" },
            { name: "Ốc hương rang muối", price: 150000, description: "Ốc ngọt, vị mặn cay kích thích" },
            { name: "Mực lá nướng muối ớt", price: 180000, description: "Mực giòn, sốt muối ớt cay nồng" },
            { name: "Cua gạch hấp bia", price: 350000, description: "Cua nhiều gạch, thịt chắc ngọt" },
            { name: "Gà nướng lu", price: 320000, description: "Gà ta thả vườn, da giòn rụm" },
            { name: "Bò tơ Tây Ninh nướng", price: 180000, description: "Thịt bò mềm, nướng tảng tại bàn" },
            { name: "Lẩu gà lá é", price: 250000, description: "Cay nồng đặc trưng, thơm mùi lá é" },
            { name: "Vịt quay Bắc Kinh", price: 380000, description: "Da vịt giòn, cuốn bánh tráng" },
            { name: "Chân gà quái thú", price: 95000, description: "Chân gà chiên mắm, vị cay đậm" },
            { name: "Hàu nướng mỡ hành", price: 25000, description: "Hàu sữa béo, hành phi thơm nức" },
            { name: "Cá lóc nướng trui", price: 160000, description: "Cuốn bánh tráng, rau sống, mắm nêm" },
            { name: "Ếch sapo", price: 110000, description: "Thịt ếch chắc, sốt tiêu đen cay nhẹ" },
            { name: "Sò huyết cháy tỏi", price: 130000, description: "Sò huyết tươi, tỏi phi thơm lừng" },
            // --- MÓN ĂN VẶT & ĐẶC SẢN VÙNG MIỀN ---
            { name: "Bánh mì heo quay", price: 30000, description: "Heo quay giòn tan, nước sốt đậm đà" },
            { name: "Bánh cuốn Thanh Trì", price: 35000, description: "Bánh tráng mỏng, hành phi thơm" },
            { name: "Xôi xéo Hà Nội", price: 25000, description: "Xôi dẻo, đậu xanh bùi bùi" },
            { name: "Bánh xèo miền Tây", price: 50000, description: "Bánh to, nhiều tôm thịt" },
            { name: "Bún chả cá Nha Trang", price: 45000, description: "Chả cá thác lác, nước dùng thanh" },
            { name: "Miến lươn đồng", price: 60000, description: "Lươn chiên giòn hoặc lươn mềm" },
            { name: "Bánh hỏi heo quay", price: 55000, description: "Bánh hỏi lá hẹ, heo quay da giòn" },
            { name: "Nem nướng Ninh Hòa", price: 80000, description: "Mẹt nem nướng tự cuốn, mắm đậu đặc biệt" },
            { name: "Bánh khọt Vũng Tàu", price: 60000, description: "Nhân tôm tươi, ăn kèm rau sống" },
            { name: "Bún sứa Nha Trang", price: 45000, description: "Sứa giòn sần sật, nước dùng cá" },
            { name: "Cháo ếch Singapore", price: 75000, description: "Ếch kho đậm đà ăn kèm cháo trắng" },
            { name: "Bánh bèo chén", price: 40000, description: "Set 10 chén, tôm chấy, mỡ hành" },
            { name: "Mì sườn kho", price: 65000, description: "Sườn mềm, nước sốt đậm vị tiêu" },
            { name: "Cơm tấm Long Xuyên", price: 45000, description: "Thịt thái nhỏ, trứng kho cắt hạt lựu" },
            { name: "Bún mắm miền Tây", price: 75000, description: "Mắm linh, mắm sặc đặc trưng" },
            { name: "Bánh tráng phơi sương", price: 90000, description: "Cuốn thịt luộc, rau rừng Trảng Bàng" },
            { name: "Gỏi ngó sen tôm thịt", price: 85000, description: "Vị chua ngọt, tôm thịt tươi ngon" },
            { name: "Đuôi bò hầm thuốc bắc", price: 180000, description: "Bổ dưỡng, nước dùng đậm đà" },
            { name: "Cá kho khoai môn", price: 120000, description: "Cá béo, khoai môn bùi" },
            { name: "Canh chua cá lóc", price: 95000, description: "Đậm chất miền Tây Nam Bộ" }
        ],
        cafe: [
            // --- CÀ PHÊ (20 món) ---
            { name: "Cà phê sữa đá", price: 25000, description: "Robusta đậm đà" },
            { name: "Cà phê đen đá", price: 20000, description: "Nguyên chất không đường" },
            { name: "Bạc xỉu cốt dừa", price: 45000, description: "Vị béo thơm cốt dừa" },
            { name: "Cà phê trứng", price: 55000, description: "Kem trứng mịn màng" },
            { name: "Cà phê muối", price: 35000, description: "Hương vị mặn ngọt độc đáo" },
            { name: "Latte Art", price: 50000, description: "Espresso kèm bọt sữa" },
            { name: "Cappuccino", price: 50000, description: "Lớp bọt sữa dày mịn" },
            { name: "Cold Brew cam sả", price: 55000, description: "Cà phê ủ lạnh thanh mát" },
            { name: "Americano", price: 35000, description: "Espresso pha loãng thanh tao" },
            { name: "Mocha đá xay", price: 60000, description: "Hương socola hòa quyện cà phê" },
            { name: "Caramel Macchiato", price: 65000, description: "Ngọt ngào hương caramel" },
            { name: "Cà phê dừa xay", price: 50000, description: "Sinh tố dừa mix espresso" },
            { name: "Espresso Tonic", price: 55000, description: "Sảng khoái, mới lạ" },
            { name: "Cà phê bơ", price: 60000, description: "Bơ sáp xay cùng cà phê" },
            { name: "Flat White", price: 55000, description: "Sữa nóng và espresso đậm" },
            { name: "Cà phê sữa nóng", price: 25000, description: "Ấm áp buổi sáng" },
            { name: "Affogato", price: 45000, description: "Kem vani rưới espresso" },
            { name: "Cà phê hạnh nhân", price: 55000, description: "Thơm bùi vị hạt" },
            { name: "Irish Coffee", price: 85000, description: "Cà phê pha chút rượu mạnh" },
            { name: "Cà phê phin giấy", price: 40000, description: "Tiện lợi, giữ hương vị" },
            // --- TRÀ & ĐỒ UỐNG GIẢI NHIỆT (20 món) ---
            { name: "Trà đào cam sả", price: 45000, description: "Đào miếng giòn ngọt" },
            { name: "Trà vải sen", price: 45000, description: "Hương sen thanh khiết" },
            { name: "Trà mãng cầu xiêm", price: 38000, description: "Giải nhiệt cực tốt" },
            { name: "Trà sữa trân châu", price: 35000, description: "Trà đậm sữa béo" },
            { name: "Trà xanh lài", price: 30000, description: "Thơm mùi hoa nhài" },
            { name: "Nước ép cam tươi", price: 40000, description: "100% nguyên chất" },
            { name: "Sinh tố bơ sáp", price: 55000, description: "Bơ dẻo mịn từ Đắk Lắk" },
            { name: "Soda Blue Ocean", price: 40000, description: "Màu xanh bạc hà" },
            { name: "Mojito chanh leo", price: 45000, description: "Chua ngọt sảng khoái" },
            { name: "Trà dâu tằm", price: 42000, description: "Vị chua thanh tự nhiên" },
            { name: "Trà Oolong váng sữa", price: 50000, description: "Lớp Macchiato béo ngậy" },
            { name: "Nước ép cần tây", price: 55000, description: "Healthy cho sức khỏe" },
            { name: "Sinh tố xoài cát", price: 45000, description: "Xoài chín thơm nức" },
            { name: "Sữa tươi trân châu đường đen", price: 50000, description: "Vị ngọt đặc trưng" },
            { name: "Trà măng cụt", price: 45000, description: "Món trà hot mùa hè" },
            { name: "Nước ép dứa mật", price: 35000, description: "Thơm ngọt tự nhiên" },
            { name: "Trà lài đười ươi", price: 40000, description: "Thanh lọc cơ thể" },
            { name: "Matcha Latte", price: 55000, description: "Bột trà xanh Nhật Bản" },
            { name: "Trà hoa cúc mật ong", price: 35000, description: "Thư giãn tinh thần" },
            { name: "Nước rau má đậu xanh", price: 25000, description: "Mát gan giải độc" },
            // --- BÁNH & ĂN VẶT (10 món) ---
            { name: "Bánh sừng bò", price: 35000, description: "Thơm bơ giòn rụm" },
            { name: "Tiramisu", price: 65000, description: "Cốt bánh thấm cà phê" },
            { name: "Red Velvet", price: 60000, description: "Vị socola nhẹ nhàng" },
            { name: "Bông lan trứng muối", price: 45000, description: "Sốt phô mai béo" },
            { name: "Sữa chua dẻo", price: 25000, description: "Xắt miếng vừa ăn" },
            { name: "Bánh Cookies", price: 15000, description: "Ăn kèm cà phê" },
            { name: "Mousse chanh dây", price: 55000, description: "Vị chua ngọt mát" },
            { name: "Bánh mì bơ tỏi", price: 40000, description: "Thơm lừng tỏi phi" },
            { name: "Bánh Flan", price: 20000, description: "Mịn màng nước cốt dừa" },
            { name: "Macaron", price: 25000, description: "Bánh ngọt kiểu Pháp" }
        ],
        pub: [
            // --- BIA & RƯỢU (25 món) ---
            { name: "Bia Tiger bạc", price: 35000, description: "Dễ uống, sảng khoái" },
            { name: "Bia Heineken", price: 40000, description: "Hương vị đẳng cấp" },
            { name: "Bia thủ công IPA", price: 85000, description: "Đậm vị hoa bia" },
            { name: "Bia Craft Wheat", price: 75000, description: "Hương lúa mì thanh" },
            { name: "Strongbow Apple", price: 45000, description: "Nước táo lên men" },
            { name: "Cocktail Mojito", price: 110000, description: "Chanh và bạc hà" },
            { name: "Cocktail Margarita", price: 130000, description: "Tequila và chanh" },
            { name: "Rượu vang đỏ Chile", price: 150000, description: "Hương vị nồng nàn" },
            { name: "Whisky Single Malt", price: 250000, description: "Cho người sành điệu" },
            { name: "Gin & Tonic", price: 120000, description: "Cổ điển thanh mát" },
            { name: "Bia Budweiser", price: 45000, description: "Vua của các loại bia" },
            { name: "Bia Sapporo", price: 45000, description: "Hương vị từ Nhật Bản" },
            { name: "Cocktail Martini", price: 140000, description: "Sang trọng và tinh tế" },
            { name: "Rượu Vodka Shot", price: 50000, description: "Mạnh mẽ và sảng khoái" },
            { name: "Bia 333", price: 30000, description: "Vị bia truyền thống" },
            { name: "Bia Saigon Chill", price: 35000, description: "Trải nghiệm mới lạ" },
            { name: "Cocktail Sex on the Beach", price: 120000, description: "Vị trái cây nhiệt đới" },
            { name: "Rượu Rum Coke", price: 90000, description: "Pha trộn đơn giản mà ngon" },
            { name: "Bia thủ công Stout", price: 90000, description: "Hương vị cà phê và socola" },
            { name: "Cocktail Long Island Ice Tea", price: 150000, description: "Mạnh mẽ với 5 loại rượu" },
            { name: "Bia Corona", price: 55000, description: "Uống cùng lát chanh" },
            { name: "Rượu Chivas 12 (Ly)", price: 180000, description: "Êm đượm nồng nàn" },
            { name: "Cocktail Old Fashioned", price: 160000, description: "Dành cho quý ông" },
            { name: "Bia tươi đen", price: 65000, description: "Mát lạnh, vị đậm" },
            { name: "Soju trái cây", price: 75000, description: "Vị đào, dâu dễ uống" },
            // --- MỒI NHẮM (25 món) ---
            { name: "Khoai tây chiên", price: 55000, description: "Giòn tan kèm sốt" },
            { name: "Mực khô nướng", price: 160000, description: "Mực câu loại 1" },
            { name: "Lườn ngỗng hun khói", price: 145000, description: "Thịt thơm, da béo" },
            { name: "Đậu phộng tỏi ớt", price: 30000, description: "Món nhắm kinh điển" },
            { name: "Sụn gà rang muối", price: 95000, description: "Giòn sần sật" },
            { name: "Bò một nắng kiến vàng", price: 220000, description: "Đặc sản Gia Lai" },
            { name: "Chân gà sả tắc", price: 85000, description: "Chua cay kích thích" },
            { name: "Phô mai dây", price: 75000, description: "Xông khói thơm nồng" },
            { name: "Xúc xích Đức nướng", price: 95000, description: "Thịt chắc xông khói" },
            { name: "Gân bò ngâm mắm", price: 110000, description: "Giòn dai vị đậm" },
            { name: "Ếch chiên bơ", price: 120000, description: "Thơm béo hấp dẫn" },
            { name: "Tôm khô củ kiệu", price: 135000, description: "Mồi nhậu Tết truyền thống" },
            { name: "Ba chỉ bò nướng tiêu", price: 155000, description: "Thịt béo ngậy sốt cay" },
            { name: "Nộm sứa tôm thịt", price: 95000, description: "Thanh mát dễ ăn" },
            { name: "Đậu hũ lướt ván", price: 55000, description: "Ngoài giòn trong mềm" },
            { name: "Tai heo muối", price: 85000, description: "Giòn dai sần sật" },
            { name: "Cơm cháy kho quẹt", price: 65000, description: "Giòn rụm đậm vị mắm" },
            { name: "Cánh gà chiên nước mắm", price: 115000, description: "Đậm đà đưa bia" },
            { name: "Lòng heo nướng", price: 130000, description: "Thơm nức mùi gia vị" },
            { name: "Ốc mỡ xào me", price: 110000, description: "Vị chua ngọt cay" },
            { name: "Bạch tuộc nướng sa tế", price: 165000, description: "Cay nồng, mực giòn" },
            { name: "Nem chua rán", price: 50000, description: "Món nhắm đường phố" },
            { name: "Khoai lang kén", price: 45000, description: "Ngọt bùi dễ ăn" },
            { name: "Hạt điều rang muối", price: 65000, description: "Giàu dinh dưỡng" },
            { name: "Thịt trâu gác bếp", price: 280000, description: "Đặc sản Tây Bắc" }
        ]
    };

    return rawRestaurants.map(res => {
        const cuisineLower = (res.cuisine || 'restaurant').toLowerCase();
        const category = pools[cuisineLower] ? cuisineLower : 'restaurant';
        const currentPool = pools[category];

        const menuSize = Math.floor(Math.random() * 3) + 3;
        const shuffledMenu: MenuItemDto[] = [...currentPool]
            .sort(() => Math.random() - 0.5)
            .slice(0, menuSize)
            .map(item => ({
                name: item.name,
                price: item.price + (Math.floor(Math.random() * 11) - 5) * 1000,
                description: item.description
            }));

        const restaurant: RestaurantDto = {
            name: res.name,
            address: res.address,
            location: res.location,
            priceRange: category === 'cafe' ? 1 : Math.floor(Math.random() * 2) + 2,
            rating: parseFloat((Math.random() * 1.5 + 3.5).toFixed(1)),
            menu: shuffledMenu,
            openingHours: {
                open: category === 'cafe' ? "06:30" : "10:00",
                close: category === 'pub' ? "23:59" : "22:00"
            },
            guest_id: guestId
        };

        return restaurant;
    });
};