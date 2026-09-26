const selections = {
  platform: "any",
  type: "any",
  mood: "random",
  time: "any"
};


// Obtener todos los grupos de opciones

const optionGroups = document.querySelectorAll(".options");

optionGroups.forEach((group) => {

  const buttons = group.querySelectorAll(".option");

  const groupName = group.dataset.group;


  buttons.forEach((button) => {

    button.addEventListener("click", () => {

      // Quitar selección anterior
      buttons.forEach((btn) => {
        btn.classList.remove("selected");
      });


      // Seleccionar nuevo botón
      button.classList.add("selected");


      // Guardar valor
      selections[groupName] = button.dataset.value;

      console.log(selections);

    });

  });

});



// BOTÓN PRINCIPAL

const recommendButton =
  document.getElementById("recommendButton");

const result =
  document.getElementById("result");

const selectionSummary =
  document.getElementById("selectionSummary");


recommendButton.addEventListener("click", () => {

  selectionSummary.innerHTML = `
    Plataforma: ${selections.platform}<br>
    Tipo: ${selections.type}<br>
    Mood: ${selections.mood}<br>
    Tiempo: ${selections.time}
  `;

  result.classList.remove("hidden");


  result.scrollIntoView({
    behavior: "smooth"
  });

});