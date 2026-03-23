let funcs = []

for (let i = 0; i < 5; i++) {
    let f = () => console.log("i=" + i);
    funcs.push(f);
    if (i === 1) {
        i++; // Mutate inside loop
    }
}

// Call funcs
funcs.forEach((f, idx) => {
    f();
});
